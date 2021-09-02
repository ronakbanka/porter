package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"

	"gorm.io/gorm"

	semver "github.com/Masterminds/semver/v3"
	"github.com/porter-dev/porter/internal/analytics"
	"github.com/porter-dev/porter/internal/kubernetes/prometheus"
	"github.com/porter-dev/porter/internal/models"
	"github.com/porter-dev/porter/internal/templater/parser"
	"helm.sh/helm/v3/pkg/release"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/go-chi/chi"
	"github.com/porter-dev/porter/internal/forms"
	"github.com/porter-dev/porter/internal/helm"
	"github.com/porter-dev/porter/internal/helm/grapher"
	"github.com/porter-dev/porter/internal/helm/loader"
	"github.com/porter-dev/porter/internal/integrations/ci/actions"
	"github.com/porter-dev/porter/internal/integrations/slack"
	"github.com/porter-dev/porter/internal/kubernetes"
	"github.com/porter-dev/porter/internal/repository"
	"gopkg.in/yaml.v2"
)

// Enumeration of release API error codes, represented as int64
const (
	ErrReleaseDecode ErrorCode = iota + 600
	ErrReleaseValidateFields
	ErrReleaseReadData
	ErrReleaseDeploy
)

var (
	createEnvSecretConstraint, _ = semver.NewConstraint(" < 0.1.0")
)

// HandleListReleases retrieves a list of releases for a cluster
// with various filter options
func (app *App) HandleListReleases(w http.ResponseWriter, r *http.Request) {
	form := &forms.ListReleaseForm{
		ReleaseForm: &forms.ReleaseForm{
			Form: &helm.Form{
				Repo:              app.Repo,
				DigitalOceanOAuth: app.DOConf,
			},
		},
		ListFilter: &helm.ListFilter{},
	}

	agent, err := app.getAgentFromQueryParams(
		w,
		r,
		form.ReleaseForm,
		form.ReleaseForm.PopulateHelmOptionsFromQueryParams,
		form.PopulateListFromQueryParams,
	)

	// errors are handled in app.getAgentFromQueryParams
	if err != nil {
		return
	}

	releases, err := agent.ListReleases(form.Namespace, form.ListFilter)

	if err != nil {
		app.handleErrorRead(err, ErrReleaseReadData, w)
		return
	}

	if err := json.NewEncoder(w).Encode(releases); err != nil {
		app.handleErrorFormDecoding(err, ErrReleaseDecode, w)
		return
	}
}

// PorterRelease is a helm release with a form attached
type PorterRelease struct {
	*release.Release
	Form            *models.FormYAML                `json:"form"`
	HasMetrics      bool                            `json:"has_metrics"`
	LatestVersion   string                          `json:"latest_version"`
	GitActionConfig *models.GitActionConfigExternal `json:"git_action_config"`
	ImageRepoURI    string                          `json:"image_repo_uri"`
}

// HandleGetRelease retrieves a single release based on a name and revision
func (app *App) HandleGetRelease(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	revision, err := strconv.ParseUint(chi.URLParam(r, "revision"), 0, 64)

	form := &forms.GetReleaseForm{
		ReleaseForm: &forms.ReleaseForm{
			Form: &helm.Form{
				Repo:              app.Repo,
				DigitalOceanOAuth: app.DOConf,
			},
		},
		Name:     name,
		Revision: int(revision),
	}

	agent, err := app.getAgentFromQueryParams(
		w,
		r,
		form.ReleaseForm,
		form.ReleaseForm.PopulateHelmOptionsFromQueryParams,
	)

	// errors are handled in app.getAgentFromQueryParams
	if err != nil {
		return
	}

	release, err := agent.GetRelease(form.Name, form.Revision, false)

	if err != nil {
		app.sendExternalError(err, http.StatusNotFound, HTTPError{
			Code:   ErrReleaseReadData,
			Errors: []string{"release not found"},
		}, w)

		return
	}

	// get the filter options
	k8sForm := &forms.K8sForm{
		OutOfClusterConfig: &kubernetes.OutOfClusterConfig{
			Repo:              app.Repo,
			DigitalOceanOAuth: app.DOConf,
		},
	}

	vals, err := url.ParseQuery(r.URL.RawQuery)

	if err != nil {
		app.handleErrorFormDecoding(err, ErrReleaseDecode, w)
		return
	}

	k8sForm.PopulateK8sOptionsFromQueryParams(vals, app.Repo.Cluster)
	k8sForm.DefaultNamespace = form.ReleaseForm.Namespace

	// validate the form
	if err := app.validator.Struct(k8sForm); err != nil {
		app.handleErrorFormValidation(err, ErrK8sValidate, w)
		return
	}

	// create a new dynamic client
	dynClient, err := kubernetes.GetDynamicClientOutOfClusterConfig(k8sForm.OutOfClusterConfig)

	if err != nil {
		app.handleErrorFormDecoding(err, ErrReleaseDecode, w)
		return
	}

	parserDef := &parser.ClientConfigDefault{
		DynamicClient: dynClient,
		HelmChart:     release.Chart,
		HelmRelease:   release,
	}

	res := &PorterRelease{release, nil, false, "", nil, ""}

	for _, file := range release.Chart.Files {
		if strings.Contains(file.Name, "form.yaml") {
			formYAML, err := parser.FormYAMLFromBytes(parserDef, file.Data, "")

			if err != nil {
				break
			}

			res.Form = formYAML
			break
		}
	}

	// if form not populated, detect common charts
	if res.Form == nil {
		// for now just case by name
		if res.Release.Chart.Name() == "velero" {
			formYAML, err := parser.FormYAMLFromBytes(parserDef, []byte(veleroForm), "")

			if err == nil {
				res.Form = formYAML
			}
		}
	}

	// get prometheus service
	_, found, err := prometheus.GetPrometheusService(agent.K8sAgent.Clientset)

	if err != nil {
		app.handleErrorFormValidation(err, ErrK8sValidate, w)
		return
	}

	res.HasMetrics = found

	// detect if Porter application chart and attempt to get the latest version
	// from chart repo
	chartRepoURL, firstFound := app.ChartLookupURLs[res.Chart.Metadata.Name]

	if !firstFound {
		app.updateChartRepoURLs()

		chartRepoURL, _ = app.ChartLookupURLs[res.Chart.Metadata.Name]
	}

	if chartRepoURL != "" {
		repoIndex, err := loader.LoadRepoIndexPublic(chartRepoURL)

		if err == nil {
			porterChart := loader.FindPorterChartInIndexList(repoIndex, res.Chart.Metadata.Name)
			res.LatestVersion = res.Chart.Metadata.Version

			// set latest version to the greater of porterChart.Versions and res.Chart.Metadata.Version
			porterChartVersion, porterChartErr := semver.NewVersion(porterChart.Versions[0])
			currChartVersion, currChartErr := semver.NewVersion(res.Chart.Metadata.Version)

			if currChartErr == nil && porterChartErr == nil && porterChartVersion.GreaterThan(currChartVersion) {
				res.LatestVersion = porterChart.Versions[0]
			}
		}
	}

	// if the release was created from this server,
	modelRelease, err := app.Repo.Release.ReadRelease(form.Cluster.ID, release.Name, release.Namespace)

	if modelRelease != nil {
		res.ImageRepoURI = modelRelease.ImageRepoURI

		gitAction := modelRelease.GitActionConfig

		if gitAction.ID != 0 {
			res.GitActionConfig = gitAction.Externalize()
		}
	}

	if err := json.NewEncoder(w).Encode(res); err != nil {
		app.handleErrorFormDecoding(err, ErrReleaseDecode, w)
		return
	}
}

// HandleGetReleaseComponents retrieves kubernetes objects listed in a release identified by name and revision
func (app *App) HandleGetReleaseComponents(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	revision, err := strconv.ParseUint(chi.URLParam(r, "revision"), 0, 64)

	form := &forms.GetReleaseForm{
		ReleaseForm: &forms.ReleaseForm{
			Form: &helm.Form{
				Repo:              app.Repo,
				DigitalOceanOAuth: app.DOConf,
			},
		},
		Name:     name,
		Revision: int(revision),
	}

	agent, err := app.getAgentFromQueryParams(
		w,
		r,
		form.ReleaseForm,
		form.ReleaseForm.PopulateHelmOptionsFromQueryParams,
	)

	// errors are handled in app.getAgentFromQueryParams
	if err != nil {
		return
	}

	release, err := agent.GetRelease(form.Name, form.Revision, false)

	if err != nil {
		app.sendExternalError(err, http.StatusNotFound, HTTPError{
			Code:   ErrReleaseReadData,
			Errors: []string{"release not found"},
		}, w)

		return
	}

	yamlArr := grapher.ImportMultiDocYAML([]byte(release.Manifest))
	objects := grapher.ParseObjs(yamlArr, release.Namespace)

	parsed := grapher.ParsedObjs{
		Objects: objects,
	}

	parsed.GetControlRel()
	parsed.GetLabelRel()
	parsed.GetSpecRel()

	if err := json.NewEncoder(w).Encode(parsed); err != nil {
		app.handleErrorFormDecoding(err, ErrReleaseDecode, w)
		return
	}
}

// HandleGetReleaseControllers retrieves controllers that belong to a release.
// Used to display status of charts.
func (app *App) HandleGetReleaseControllers(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	revision, err := strconv.ParseUint(chi.URLParam(r, "revision"), 0, 64)

	form := &forms.GetReleaseForm{
		ReleaseForm: &forms.ReleaseForm{
			Form: &helm.Form{
				Repo:              app.Repo,
				DigitalOceanOAuth: app.DOConf,
			},
		},
		Name:     name,
		Revision: int(revision),
	}

	agent, err := app.getAgentFromQueryParams(
		w,
		r,
		form.ReleaseForm,
		form.ReleaseForm.PopulateHelmOptionsFromQueryParams,
	)

	// errors are handled in app.getAgentFromQueryParams
	if err != nil {
		return
	}

	release, err := agent.GetRelease(form.Name, form.Revision, false)

	if err != nil {
		app.sendExternalError(err, http.StatusNotFound, HTTPError{
			Code:   ErrReleaseReadData,
			Errors: []string{"release not found"},
		}, w)

		return
	}

	vals, err := url.ParseQuery(r.URL.RawQuery)

	if err != nil {
		app.handleErrorFormDecoding(err, ErrReleaseDecode, w)
		return
	}

	// get the filter options
	k8sForm := &forms.K8sForm{
		OutOfClusterConfig: &kubernetes.OutOfClusterConfig{
			Repo:              app.Repo,
			DigitalOceanOAuth: app.DOConf,
		},
	}

	k8sForm.PopulateK8sOptionsFromQueryParams(vals, app.Repo.Cluster)
	k8sForm.DefaultNamespace = form.ReleaseForm.Namespace

	// validate the form
	if err := app.validator.Struct(k8sForm); err != nil {
		app.handleErrorFormValidation(err, ErrK8sValidate, w)
		return
	}

	// create a new kubernetes agent
	var k8sAgent *kubernetes.Agent

	if app.ServerConf.IsTesting {
		k8sAgent = app.TestAgents.K8sAgent
	} else {
		k8sAgent, err = kubernetes.GetAgentOutOfClusterConfig(k8sForm.OutOfClusterConfig)
	}

	yamlArr := grapher.ImportMultiDocYAML([]byte(release.Manifest))
	controllers := grapher.ParseControllers(yamlArr)
	retrievedControllers := []interface{}{}

	// get current status of each controller
	// TODO: refactor with type assertion
	for _, c := range controllers {
		c.Namespace = form.ReleaseForm.Form.Namespace
		switch c.Kind {
		case "Deployment":
			rc, err := k8sAgent.GetDeployment(c)

			if err != nil {
				app.handleErrorDataRead(err, w)
				return
			}

			rc.Kind = c.Kind
			retrievedControllers = append(retrievedControllers, rc)
		case "StatefulSet":
			rc, err := k8sAgent.GetStatefulSet(c)

			if err != nil {
				app.handleErrorDataRead(err, w)
				return
			}

			rc.Kind = c.Kind
			retrievedControllers = append(retrievedControllers, rc)
		case "DaemonSet":
			rc, err := k8sAgent.GetDaemonSet(c)

			if err != nil {
				app.handleErrorDataRead(err, w)
				return
			}

			rc.Kind = c.Kind
			retrievedControllers = append(retrievedControllers, rc)
		case "ReplicaSet":
			rc, err := k8sAgent.GetReplicaSet(c)

			if err != nil {
				app.handleErrorDataRead(err, w)
				return
			}

			rc.Kind = c.Kind
			retrievedControllers = append(retrievedControllers, rc)
		case "CronJob":
			rc, err := k8sAgent.GetCronJob(c)

			if err != nil {
				app.handleErrorDataRead(err, w)
				return
			}

			rc.Kind = c.Kind
			retrievedControllers = append(retrievedControllers, rc)
		}
	}

	if err := json.NewEncoder(w).Encode(retrievedControllers); err != nil {
		app.handleErrorFormDecoding(err, ErrReleaseDecode, w)
		return
	}
}

// HandleGetReleaseAllPods retrieves all pods that are associated with a given release.
func (app *App) HandleGetReleaseAllPods(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	revision, err := strconv.ParseUint(chi.URLParam(r, "revision"), 0, 64)

	form := &forms.GetReleaseForm{
		ReleaseForm: &forms.ReleaseForm{
			Form: &helm.Form{
				Repo:              app.Repo,
				DigitalOceanOAuth: app.DOConf,
			},
		},
		Name:     name,
		Revision: int(revision),
	}

	agent, err := app.getAgentFromQueryParams(
		w,
		r,
		form.ReleaseForm,
		form.ReleaseForm.PopulateHelmOptionsFromQueryParams,
	)

	// errors are handled in app.getAgentFromQueryParams
	if err != nil {
		return
	}

	release, err := agent.GetRelease(form.Name, form.Revision, false)

	if err != nil {
		app.sendExternalError(err, http.StatusNotFound, HTTPError{
			Code:   ErrReleaseReadData,
			Errors: []string{"release not found"},
		}, w)

		return
	}

	vals, err := url.ParseQuery(r.URL.RawQuery)

	if err != nil {
		app.handleErrorFormDecoding(err, ErrReleaseDecode, w)
		return
	}

	// get the filter options
	k8sForm := &forms.K8sForm{
		OutOfClusterConfig: &kubernetes.OutOfClusterConfig{
			Repo:              app.Repo,
			DigitalOceanOAuth: app.DOConf,
		},
	}

	k8sForm.PopulateK8sOptionsFromQueryParams(vals, app.Repo.Cluster)
	k8sForm.DefaultNamespace = form.ReleaseForm.Namespace

	// validate the form
	if err := app.validator.Struct(k8sForm); err != nil {
		app.handleErrorFormValidation(err, ErrK8sValidate, w)
		return
	}

	// create a new kubernetes agent
	var k8sAgent *kubernetes.Agent

	if app.ServerConf.IsTesting {
		k8sAgent = app.TestAgents.K8sAgent
	} else {
		k8sAgent, err = kubernetes.GetAgentOutOfClusterConfig(k8sForm.OutOfClusterConfig)
	}

	yamlArr := grapher.ImportMultiDocYAML([]byte(release.Manifest))
	controllers := grapher.ParseControllers(yamlArr)
	pods := make([]v1.Pod, 0)

	// get current status of each controller
	for _, c := range controllers {
		var selector *metav1.LabelSelector

		switch c.Kind {
		case "Deployment":
			rc, err := k8sAgent.GetDeployment(c)

			if err != nil {
				app.handleErrorDataRead(err, w)
				return
			}

			selector = rc.Spec.Selector
		case "StatefulSet":
			rc, err := k8sAgent.GetStatefulSet(c)

			if err != nil {
				app.handleErrorDataRead(err, w)
				return
			}

			selector = rc.Spec.Selector
		case "DaemonSet":
			rc, err := k8sAgent.GetDaemonSet(c)

			if err != nil {
				app.handleErrorDataRead(err, w)
				return
			}

			selector = rc.Spec.Selector
		case "ReplicaSet":
			rc, err := k8sAgent.GetReplicaSet(c)

			if err != nil {
				app.handleErrorDataRead(err, w)
				return
			}

			selector = rc.Spec.Selector
		case "CronJob":
			rc, err := k8sAgent.GetCronJob(c)

			if err != nil {
				app.handleErrorDataRead(err, w)
				return
			}

			selector = rc.Spec.JobTemplate.Spec.Selector
		}

		selectors := make([]string, 0)

		for key, val := range selector.MatchLabels {
			selectors = append(selectors, key+"="+val)
		}

		namespace := vals.Get("namespace")
		podList, err := k8sAgent.GetPodsByLabel(strings.Join(selectors, ","), namespace)

		if err != nil {
			app.handleErrorDataRead(err, w)
			return
		}

		pods = append(pods, podList.Items...)
	}

	if err := json.NewEncoder(w).Encode(pods); err != nil {
		app.handleErrorFormDecoding(err, ErrReleaseDecode, w)
		return
	}
}

type GetJobStatusResult struct {
	Status    string       `json:"status,omitempty"`
	StartTime *metav1.Time `json:"start_time,omitempty"`
}

// HandleGetJobStatus gets the status for a specific job
func (app *App) HandleGetJobStatus(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	namespace := chi.URLParam(r, "namespace")

	form := &forms.GetReleaseForm{
		ReleaseForm: &forms.ReleaseForm{
			Form: &helm.Form{
				Repo:              app.Repo,
				DigitalOceanOAuth: app.DOConf,
				Storage:           "secret",
				Namespace:         namespace,
			},
		},
		Name:     name,
		Revision: 0,
	}

	agent, err := app.getAgentFromQueryParams(
		w,
		r,
		form.ReleaseForm,
		form.ReleaseForm.PopulateHelmOptionsFromQueryParams,
	)

	// errors are handled in app.getAgentFromQueryParams
	if err != nil {
		return
	}

	release, err := agent.GetRelease(form.Name, form.Revision, false)

	if err != nil {
		app.sendExternalError(err, http.StatusNotFound, HTTPError{
			Code:   ErrReleaseReadData,
			Errors: []string{"release not found"},
		}, w)

		return
	}

	vals, err := url.ParseQuery(r.URL.RawQuery)

	if err != nil {
		app.handleErrorFormDecoding(err, ErrReleaseDecode, w)
		return
	}

	// get the filter options
	k8sForm := &forms.K8sForm{
		OutOfClusterConfig: &kubernetes.OutOfClusterConfig{
			Repo:              app.Repo,
			DigitalOceanOAuth: app.DOConf,
		},
	}

	k8sForm.PopulateK8sOptionsFromQueryParams(vals, app.Repo.Cluster)
	k8sForm.DefaultNamespace = form.ReleaseForm.Namespace

	// validate the form
	if err := app.validator.Struct(k8sForm); err != nil {
		app.handleErrorFormValidation(err, ErrK8sValidate, w)
		return
	}

	// create a new kubernetes agent
	var k8sAgent *kubernetes.Agent

	if app.ServerConf.IsTesting {
		k8sAgent = app.TestAgents.K8sAgent
	} else {
		k8sAgent, err = kubernetes.GetAgentOutOfClusterConfig(k8sForm.OutOfClusterConfig)
	}

	jobs, err := k8sAgent.ListJobsByLabel(namespace, kubernetes.Label{
		Key: "helm.sh/chart",
		Val: fmt.Sprintf("%s-%s", release.Chart.Name(), release.Chart.Metadata.Version),
	}, kubernetes.Label{
		Key: "meta.helm.sh/release-name",
		Val: name,
	})

	if err != nil {
		app.handleErrorFormDecoding(err, ErrReleaseDecode, w)
		return
	}

	res := &GetJobStatusResult{}

	// get the most recent job
	if len(jobs) > 0 {
		mostRecentJob := jobs[0]

		for _, job := range jobs {
			createdAt := job.ObjectMeta.CreationTimestamp

			if mostRecentJob.CreationTimestamp.Before(&createdAt) {
				mostRecentJob = job
			}
		}

		res.StartTime = mostRecentJob.Status.StartTime

		// get the status of the most recent job
		if mostRecentJob.Status.Succeeded >= 1 {
			res.Status = "succeeded"
		} else if mostRecentJob.Status.Active >= 1 {
			res.Status = "running"
		} else if mostRecentJob.Status.Failed >= 1 {
			res.Status = "failed"
		}
	}

	if err := json.NewEncoder(w).Encode(res); err != nil {
		app.handleErrorFormDecoding(err, ErrK8sDecode, w)
		return
	}
}

// HandleListReleaseHistory retrieves a history of releases based on a release name
func (app *App) HandleListReleaseHistory(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")

	form := &forms.ListReleaseHistoryForm{
		ReleaseForm: &forms.ReleaseForm{
			Form: &helm.Form{
				Repo:              app.Repo,
				DigitalOceanOAuth: app.DOConf,
			},
		},
		Name: name,
	}

	agent, err := app.getAgentFromQueryParams(
		w,
		r,
		form.ReleaseForm,
		form.ReleaseForm.PopulateHelmOptionsFromQueryParams,
	)

	// errors are handled in app.getAgentFromQueryParams
	if err != nil {
		return
	}

	release, err := agent.GetReleaseHistory(form.Name)

	if err != nil {
		app.sendExternalError(err, http.StatusNotFound, HTTPError{
			Code:   ErrReleaseReadData,
			Errors: []string{"release not found"},
		}, w)

		return
	}

	if err := json.NewEncoder(w).Encode(release); err != nil {
		app.handleErrorFormDecoding(err, ErrReleaseDecode, w)
		return
	}
}

// HandleGetReleaseToken retrieves the webhook token of a specific release.
func (app *App) HandleGetReleaseToken(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")

	vals, err := url.ParseQuery(r.URL.RawQuery)
	namespace := vals["namespace"][0]

	clusterID, err := strconv.ParseUint(vals["cluster_id"][0], 10, 64)

	if err != nil {
		app.sendExternalError(err, http.StatusInternalServerError, HTTPError{
			Code:   ErrReleaseReadData,
			Errors: []string{"release not found"},
		}, w)

		return
	}

	release, err := app.Repo.Release.ReadRelease(uint(clusterID), name, namespace)

	if err != nil {
		app.sendExternalError(err, http.StatusInternalServerError, HTTPError{
			Code:   ErrReleaseReadData,
			Errors: []string{"release not found"},
		}, w)

		return
	}

	releaseExt := release.Externalize()

	if err := json.NewEncoder(w).Encode(releaseExt); err != nil {
		app.handleErrorFormDecoding(err, ErrReleaseDecode, w)
		return
	}
}

// HandleCreateWebhookToken creates a new webhook token for a release
func (app *App) HandleCreateWebhookToken(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")

	vals, err := url.ParseQuery(r.URL.RawQuery)

	if err != nil {
		app.sendExternalError(err, http.StatusInternalServerError, HTTPError{
			Code:   ErrReleaseReadData,
			Errors: []string{"release not found"},
		}, w)

		return
	}

	// read the release from the target cluster
	form := &forms.ReleaseForm{
		Form: &helm.Form{
			Repo:              app.Repo,
			DigitalOceanOAuth: app.DOConf,
		},
	}

	form.PopulateHelmOptionsFromQueryParams(
		vals,
		app.Repo.Cluster,
	)

	agent, err := app.getAgentFromReleaseForm(
		w,
		r,
		form,
	)

	if err != nil {
		app.handleErrorFormDecoding(err, ErrUserDecode, w)
		return
	}

	rel, err := agent.GetRelease(name, 0, false)

	if err != nil {
		app.handleErrorDataRead(err, w)
		return
	}

	token, err := repository.GenerateRandomBytes(16)

	if err != nil {
		app.handleErrorInternal(err, w)
		return
	}

	// create release with webhook token in db
	image, ok := rel.Config["image"].(map[string]interface{})
	if !ok {
		app.handleErrorInternal(fmt.Errorf("Could not find field image in config"), w)
		return
	}

	repository := image["repository"]
	repoStr, ok := repository.(string)

	if !ok {
		app.handleErrorInternal(fmt.Errorf("Could not find field repository in config"), w)
		return
	}

	release := &models.Release{
		ClusterID:    form.Form.Cluster.ID,
		ProjectID:    form.Form.Cluster.ProjectID,
		Namespace:    form.Form.Namespace,
		Name:         name,
		WebhookToken: token,
		ImageRepoURI: repoStr,
	}

	release, err = app.Repo.Release.CreateRelease(release)

	if err != nil {
		app.handleErrorInternal(err, w)
		return
	}

	releaseExt := release.Externalize()

	if err := json.NewEncoder(w).Encode(releaseExt); err != nil {
		app.handleErrorFormDecoding(err, ErrReleaseDecode, w)
		return
	}
}

type ContainerEnvConfig struct {
	Container struct {
		Env struct {
			Normal map[string]string `yaml:"normal"`
		} `yaml:"env"`
	} `yaml:"container"`
}

// HandleUpgradeRelease upgrades a release with new values.yaml
func (app *App) HandleUpgradeRelease(w http.ResponseWriter, r *http.Request) {
	projID, err := strconv.ParseUint(chi.URLParam(r, "project_id"), 0, 64)

	if err != nil || projID == 0 {
		app.handleErrorFormDecoding(err, ErrProjectDecode, w)
		return
	}

	name := chi.URLParam(r, "name")

	vals, err := url.ParseQuery(r.URL.RawQuery)

	if err != nil {
		app.handleErrorFormDecoding(err, ErrReleaseDecode, w)
		return
	}

	form := &forms.UpgradeReleaseForm{
		ReleaseForm: &forms.ReleaseForm{
			Form: &helm.Form{
				Repo:              app.Repo,
				DigitalOceanOAuth: app.DOConf,
			},
		},
		Name: name,
	}

	form.ReleaseForm.PopulateHelmOptionsFromQueryParams(
		vals,
		app.Repo.Cluster,
	)

	if err := json.NewDecoder(r.Body).Decode(form); err != nil {
		app.handleErrorFormDecoding(err, ErrUserDecode, w)
		return
	}

	agent, err := app.getAgentFromReleaseForm(
		w,
		r,
		form.ReleaseForm,
	)

	// errors are handled in app.getAgentFromBodyParams
	if err != nil {
		return
	}

	registries, err := app.Repo.Registry.ListRegistriesByProjectID(uint(projID))

	if err != nil {
		app.handleErrorDataRead(err, w)
		return
	}

	conf := &helm.UpgradeReleaseConfig{
		Name:       form.Name,
		Cluster:    form.ReleaseForm.Cluster,
		Repo:       *app.Repo,
		Registries: registries,
	}

	// if the chart version is set, load a chart from the repo
	if form.ChartVersion != "" {
		release, err := agent.GetRelease(form.Name, 0, false)

		if err != nil {
			app.sendExternalError(err, http.StatusNotFound, HTTPError{
				Code:   ErrReleaseReadData,
				Errors: []string{"chart version not found"},
			}, w)

			return
		}

		chartRepoURL, foundFirst := app.ChartLookupURLs[release.Chart.Metadata.Name]

		if !foundFirst {
			app.updateChartRepoURLs()

			var found bool

			chartRepoURL, found = app.ChartLookupURLs[release.Chart.Metadata.Name]

			if !found {
				app.sendExternalError(err, http.StatusNotFound, HTTPError{
					Code:   ErrReleaseReadData,
					Errors: []string{"chart not found"},
				}, w)

				return
			}
		}

		chart, err := loader.LoadChartPublic(
			chartRepoURL,
			release.Chart.Metadata.Name,
			form.ChartVersion,
		)

		if err != nil {
			app.sendExternalError(err, http.StatusNotFound, HTTPError{
				Code:   ErrReleaseReadData,
				Errors: []string{"chart not found"},
			}, w)

			return
		}

		conf.Chart = chart
	}

	rel, upgradeErr := agent.UpgradeRelease(conf, form.Values, app.DOConf)

	slackInts, _ := app.Repo.SlackIntegration.ListSlackIntegrationsByProjectID(uint(projID))

	clusterID, err := strconv.ParseUint(vals["cluster_id"][0], 10, 64)
	release, _ := app.Repo.Release.ReadRelease(uint(clusterID), name, form.Namespace)

	var notifConf *models.NotificationConfigExternal
	notifConf = nil
	if release != nil && release.NotificationConfig != 0 {
		conf, err := app.Repo.NotificationConfig.ReadNotificationConfig(release.NotificationConfig)

		if err != nil {
			app.handleErrorInternal(err, w)
			return
		}

		notifConf = conf.Externalize()
	}

	notifier := slack.NewSlackNotifier(notifConf, slackInts...)

	notifyOpts := &slack.NotifyOpts{
		ProjectID:   uint(projID),
		ClusterID:   form.Cluster.ID,
		ClusterName: form.Cluster.Name,
		Name:        name,
		Namespace:   form.Namespace,
		URL: fmt.Sprintf(
			"%s/applications/%s/%s/%s",
			app.ServerConf.ServerURL,
			url.PathEscape(form.Cluster.Name),
			form.Namespace,
			name,
		) + fmt.Sprintf("?project_id=%d", uint(projID)),
	}

	if upgradeErr != nil {
		notifyOpts.Status = slack.StatusFailed
		notifyOpts.Info = upgradeErr.Error()

		notifier.Notify(notifyOpts)

		app.sendExternalError(err, http.StatusInternalServerError, HTTPError{
			Code:   ErrReleaseDeploy,
			Errors: []string{upgradeErr.Error()},
		}, w)

		return
	}

	notifyOpts.Status = string(rel.Info.Status)
	notifyOpts.Version = rel.Version

	notifier.Notify(notifyOpts)

	// update the github actions env if the release exists and is built from source
	if cName := rel.Chart.Metadata.Name; cName == "job" || cName == "web" || cName == "worker" {
		if err != nil {
			app.sendExternalError(err, http.StatusInternalServerError, HTTPError{
				Code:   ErrReleaseReadData,
				Errors: []string{"release not found"},
			}, w)

			return
		}

		if release != nil {
			// update image repo uri if changed
			repository := rel.Config["image"].(map[string]interface{})["repository"]
			repoStr, ok := repository.(string)

			if !ok {
				app.handleErrorInternal(fmt.Errorf("Could not find field repository in config"), w)
				return
			}

			if repoStr != release.ImageRepoURI {
				release, err = app.Repo.Release.UpdateRelease(release)

				if err != nil {
					app.handleErrorInternal(err, w)
					return
				}
			}

			gitAction := release.GitActionConfig

			if gitAction.ID != 0 {
				// parse env into build env
				cEnv := &ContainerEnvConfig{}

				yaml.Unmarshal([]byte(form.Values), cEnv)

				gr, err := app.Repo.GitRepo.ReadGitRepo(gitAction.GitRepoID)

				if err != nil {
					if err != gorm.ErrRecordNotFound {
						app.handleErrorInternal(err, w)
						return
					}
					gr = nil
				}

				repoSplit := strings.Split(gitAction.GitRepo, "/")

				gaRunner := &actions.GithubActions{
					ServerURL:              app.ServerConf.ServerURL,
					GithubOAuthIntegration: gr,
					GithubInstallationID:   gitAction.GithubInstallationID,
					GithubAppID:            app.GithubAppConf.AppID,
					GithubAppSecretPath:    app.GithubAppConf.SecretPath,
					GitRepoName:            repoSplit[1],
					GitRepoOwner:           repoSplit[0],
					Repo:                   *app.Repo,
					GithubConf:             app.GithubProjectConf,
					ProjectID:              uint(projID),
					ReleaseName:            name,
					ReleaseNamespace:       release.Namespace,
					GitBranch:              gitAction.GitBranch,
					DockerFilePath:         gitAction.DockerfilePath,
					FolderPath:             gitAction.FolderPath,
					ImageRepoURL:           gitAction.ImageRepoURI,
					BuildEnv:               cEnv.Container.Env.Normal,
					ClusterID:              release.ClusterID,
					Version:                gitAction.Version,
				}

				actionVersion, err := semver.NewVersion(gaRunner.Version)
				if err != nil {
					app.handleErrorInternal(err, w)
				}

				if createEnvSecretConstraint.Check(actionVersion) {
					if err := gaRunner.CreateEnvSecret(); err != nil {
						app.sendExternalError(err, http.StatusInternalServerError, HTTPError{
							Code:   ErrReleaseReadData,
							Errors: []string{"could not update github secret"},
						}, w)
					}
				}
			}
		}
	}

	w.WriteHeader(http.StatusOK)
}

// HandleReleaseDeployWebhook upgrades a release when a chart specific webhook is called.
func (app *App) HandleReleaseDeployWebhook(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")

	// retrieve release by token
	release, err := app.Repo.Release.ReadReleaseByWebhookToken(token)

	if err != nil {
		app.sendExternalError(err, http.StatusInternalServerError, HTTPError{
			Code:   ErrReleaseReadData,
			Errors: []string{"release not found with given webhook"},
		}, w)

		return
	}

	params := map[string][]string{}
	params["cluster_id"] = []string{fmt.Sprint(release.ClusterID)}
	params["storage"] = []string{"secret"}
	params["namespace"] = []string{release.Namespace}

	vals, err := url.ParseQuery(r.URL.RawQuery)

	if err != nil {
		app.handleErrorFormDecoding(err, ErrReleaseDecode, w)
		return
	}

	form := &forms.UpgradeReleaseForm{
		ReleaseForm: &forms.ReleaseForm{
			Form: &helm.Form{
				Repo:              app.Repo,
				DigitalOceanOAuth: app.DOConf,
			},
		},
		Name: release.Name,
	}

	form.ReleaseForm.PopulateHelmOptionsFromQueryParams(
		params,
		app.Repo.Cluster,
	)

	agent, err := app.getAgentFromReleaseForm(
		w,
		r,
		form.ReleaseForm,
	)

	// errors are handled in app.getAgentFromBodyParams
	if err != nil {
		return
	}

	rel, err := agent.GetRelease(form.Name, 0, false)

	// repository is set to current repository by default
	commit := vals["commit"][0]
	repository := rel.Config["image"].(map[string]interface{})["repository"]

	gitAction := release.GitActionConfig

	if gitAction.ID != 0 && (repository == "porterdev/hello-porter" || repository == "public.ecr.aws/o1j4x7p4/hello-porter") {
		repository = gitAction.ImageRepoURI
	} else if gitAction.ID != 0 && (repository == "porterdev/hello-porter-job" || repository == "public.ecr.aws/o1j4x7p4/hello-porter-job") {
		repository = gitAction.ImageRepoURI
	}

	image := map[string]interface{}{}
	image["repository"] = repository
	image["tag"] = commit
	rel.Config["image"] = image

	if rel.Config["auto_deploy"] == false {
		app.sendExternalError(err, http.StatusInternalServerError, HTTPError{
			Code:   ErrReleaseDeploy,
			Errors: []string{"Deploy webhook is disabled for this deployment."},
		}, w)

		return
	}

	registries, err := app.Repo.Registry.ListRegistriesByProjectID(uint(form.ReleaseForm.Cluster.ProjectID))

	if err != nil {
		app.handleErrorDataRead(err, w)
		return
	}

	conf := &helm.UpgradeReleaseConfig{
		Name:       form.Name,
		Cluster:    form.ReleaseForm.Cluster,
		Repo:       *app.Repo,
		Registries: registries,
		Values:     rel.Config,
	}

	slackInts, _ := app.Repo.SlackIntegration.ListSlackIntegrationsByProjectID(uint(form.ReleaseForm.Cluster.ProjectID))

	var notifConf *models.NotificationConfigExternal
	notifConf = nil
	if release != nil && release.NotificationConfig != 0 {
		conf, err := app.Repo.NotificationConfig.ReadNotificationConfig(release.NotificationConfig)

		if err != nil {
			app.handleErrorInternal(err, w)
			return
		}

		notifConf = conf.Externalize()
	}

	notifier := slack.NewSlackNotifier(notifConf, slackInts...)

	notifyOpts := &slack.NotifyOpts{
		ProjectID:   uint(form.ReleaseForm.Cluster.ProjectID),
		ClusterID:   form.Cluster.ID,
		ClusterName: form.Cluster.Name,
		Name:        rel.Name,
		Namespace:   rel.Namespace,
		URL: fmt.Sprintf(
			"%s/applications/%s/%s/%s",
			app.ServerConf.ServerURL,
			url.PathEscape(form.Cluster.Name),
			form.Namespace,
			rel.Name,
		) + fmt.Sprintf("?project_id=%d", uint(form.ReleaseForm.Cluster.ProjectID)),
	}

	rel, err = agent.UpgradeReleaseByValues(conf, app.DOConf)

	if err != nil {
		notifyOpts.Status = slack.StatusFailed
		notifyOpts.Info = err.Error()

		notifier.Notify(notifyOpts)

		app.sendExternalError(err, http.StatusInternalServerError, HTTPError{
			Code:   ErrReleaseDeploy,
			Errors: []string{err.Error()},
		}, w)

		return
	}

	notifyOpts.Status = string(rel.Info.Status)
	notifyOpts.Version = rel.Version

	notifier.Notify(notifyOpts)

	userID, _ := app.getUserIDFromRequest(r)

	app.AnalyticsClient.Track(analytics.ApplicationDeploymentWebhookTrack(&analytics.ApplicationDeploymentWebhookTrackOpts{
		ImageURI: fmt.Sprintf("%v", repository),
		ApplicationScopedTrackOpts: analytics.GetApplicationScopedTrackOpts(
			userID,
			release.ProjectID,
			release.ClusterID,
			release.Name,
			release.Namespace,
			rel.Chart.Metadata.Name,
		),
	}))

	w.WriteHeader(http.StatusOK)
}

// HandleReleaseJobUpdateImage
func (app *App) HandleReleaseUpdateJobImages(w http.ResponseWriter, r *http.Request) {
	vals, err := url.ParseQuery(r.URL.RawQuery)

	if err != nil {
		app.handleErrorFormDecoding(err, ErrReleaseDecode, w)
		return
	}

	form := &forms.UpdateImageForm{
		ReleaseForm: &forms.ReleaseForm{
			Form: &helm.Form{
				Repo:              app.Repo,
				DigitalOceanOAuth: app.DOConf,
			},
		},
	}

	form.ReleaseForm.PopulateHelmOptionsFromQueryParams(
		vals,
		app.Repo.Cluster,
	)

	if err := json.NewDecoder(r.Body).Decode(form); err != nil {
		app.handleErrorFormDecoding(err, ErrUserDecode, w)
		return
	}

	releases, err := app.Repo.Release.ListReleasesByImageRepoURI(form.Cluster.ID, form.ImageRepoURI)

	if err != nil {
		app.sendExternalError(err, http.StatusInternalServerError, HTTPError{
			Code:   ErrReleaseReadData,
			Errors: []string{"releases not found with given image repo uri"},
		}, w)

		return
	}

	agent, err := app.getAgentFromReleaseForm(
		w,
		r,
		form.ReleaseForm,
	)

	// errors are handled in app.getAgentFromBodyParams
	if err != nil {
		return
	}

	registries, err := app.Repo.Registry.ListRegistriesByProjectID(uint(form.ReleaseForm.Cluster.ProjectID))

	if err != nil {
		app.handleErrorDataRead(err, w)
		return
	}

	// asynchronously update releases with that image repo uri
	var wg sync.WaitGroup
	mu := &sync.Mutex{}
	errors := make([]string, 0)

	for i := range releases {
		index := i
		wg.Add(1)

		go func() {
			defer wg.Done()
			// read release via agent
			rel, err := agent.GetRelease(releases[index].Name, 0, false)

			if err != nil {
				mu.Lock()
				errors = append(errors, err.Error())
				mu.Unlock()
			}

			if rel.Chart.Name() == "job" {
				image := map[string]interface{}{}
				image["repository"] = releases[index].ImageRepoURI
				image["tag"] = form.Tag
				rel.Config["image"] = image
				rel.Config["paused"] = true

				conf := &helm.UpgradeReleaseConfig{
					Name:       releases[index].Name,
					Cluster:    form.ReleaseForm.Cluster,
					Repo:       *app.Repo,
					Registries: registries,
					Values:     rel.Config,
				}

				_, err = agent.UpgradeReleaseByValues(conf, app.DOConf)

				if err != nil {
					mu.Lock()
					errors = append(errors, err.Error())
					mu.Unlock()
				}
			}
		}()
	}

	wg.Wait()

	w.WriteHeader(http.StatusOK)
}

// HandleRollbackRelease rolls a release back to a specified revision
func (app *App) HandleRollbackRelease(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")

	vals, err := url.ParseQuery(r.URL.RawQuery)

	if err != nil {
		app.handleErrorFormDecoding(err, ErrReleaseDecode, w)
		return
	}

	form := &forms.RollbackReleaseForm{
		ReleaseForm: &forms.ReleaseForm{
			Form: &helm.Form{
				Repo:              app.Repo,
				DigitalOceanOAuth: app.DOConf,
			},
		},
		Name: name,
	}

	form.ReleaseForm.PopulateHelmOptionsFromQueryParams(
		vals,
		app.Repo.Cluster,
	)

	if err := json.NewDecoder(r.Body).Decode(form); err != nil {
		app.handleErrorFormDecoding(err, ErrUserDecode, w)
		return
	}

	agent, err := app.getAgentFromReleaseForm(
		w,
		r,
		form.ReleaseForm,
	)

	// errors are handled in app.getAgentFromBodyParams
	if err != nil {
		return
	}

	err = agent.RollbackRelease(form.Name, form.Revision)

	if err != nil {
		app.sendExternalError(err, http.StatusInternalServerError, HTTPError{
			Code:   ErrReleaseDeploy,
			Errors: []string{"error rolling back release " + err.Error()},
		}, w)

		return
	}

	// get the full release data for GHA updating
	rel, err := agent.GetRelease(form.Name, form.Revision, false)

	if err != nil {
		app.sendExternalError(err, http.StatusNotFound, HTTPError{
			Code:   ErrReleaseReadData,
			Errors: []string{"release not found"},
		}, w)

		return
	}

	// update the github actions env if the release exists and is built from source
	if cName := rel.Chart.Metadata.Name; cName == "job" || cName == "web" || cName == "worker" {
		clusterID, err := strconv.ParseUint(vals["cluster_id"][0], 10, 64)

		if err != nil {
			app.sendExternalError(err, http.StatusInternalServerError, HTTPError{
				Code:   ErrReleaseReadData,
				Errors: []string{"release not found"},
			}, w)

			return
		}

		release, err := app.Repo.Release.ReadRelease(uint(clusterID), name, rel.Namespace)

		if release != nil {
			// update image repo uri if changed
			repository := rel.Config["image"].(map[string]interface{})["repository"]
			repoStr, ok := repository.(string)

			if !ok {
				app.handleErrorInternal(fmt.Errorf("Could not find field repository in config"), w)
				return
			}

			if repoStr != release.ImageRepoURI {
				release, err = app.Repo.Release.UpdateRelease(release)

				if err != nil {
					app.handleErrorInternal(err, w)
					return
				}
			}

			gitAction := release.GitActionConfig

			if gitAction.ID != 0 {
				// parse env into build env
				cEnv := &ContainerEnvConfig{}
				rawValues, err := yaml.Marshal(rel.Config)

				if err != nil {
					app.sendExternalError(err, http.StatusInternalServerError, HTTPError{
						Code:   ErrReleaseReadData,
						Errors: []string{"could not get values of previous revision"},
					}, w)
				}

				yaml.Unmarshal(rawValues, cEnv)

				gr, err := app.Repo.GitRepo.ReadGitRepo(gitAction.GitRepoID)

				if err != nil {
					if err != gorm.ErrRecordNotFound {
						app.handleErrorInternal(err, w)
						return
					}
					gr = nil
				}

				repoSplit := strings.Split(gitAction.GitRepo, "/")

				projID, err := strconv.ParseUint(chi.URLParam(r, "project_id"), 0, 64)

				if err != nil || projID == 0 {
					app.handleErrorFormDecoding(err, ErrProjectDecode, w)
					return
				}

				gaRunner := &actions.GithubActions{
					ServerURL:              app.ServerConf.ServerURL,
					GithubOAuthIntegration: gr,
					GithubInstallationID:   gitAction.GithubInstallationID,
					GithubAppID:            app.GithubAppConf.AppID,
					GithubAppSecretPath:    app.GithubAppConf.SecretPath,
					GitRepoName:            repoSplit[1],
					GitRepoOwner:           repoSplit[0],
					Repo:                   *app.Repo,
					GithubConf:             app.GithubProjectConf,
					ProjectID:              uint(projID),
					ReleaseName:            name,
					ReleaseNamespace:       release.Namespace,
					GitBranch:              gitAction.GitBranch,
					DockerFilePath:         gitAction.DockerfilePath,
					FolderPath:             gitAction.FolderPath,
					ImageRepoURL:           gitAction.ImageRepoURI,
					BuildEnv:               cEnv.Container.Env.Normal,
					ClusterID:              release.ClusterID,
					Version:                gitAction.Version,
				}

				actionVersion, err := semver.NewVersion(gaRunner.Version)
				if err != nil {
					app.handleErrorInternal(err, w)
				}

				if createEnvSecretConstraint.Check(actionVersion) {
					if err := gaRunner.CreateEnvSecret(); err != nil {
						app.sendExternalError(err, http.StatusInternalServerError, HTTPError{
							Code:   ErrReleaseReadData,
							Errors: []string{"could not update github secret"},
						}, w)
					}
				}
			}
		}
	}

	w.WriteHeader(http.StatusOK)
}

// HandleGetReleaseSteps returns a list of all steps for a given release
// note that steps are not guaranteed to be in any specific order, so they should be ordered if needed
func (app *App) HandleGetReleaseSteps(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	vals, err := url.ParseQuery(r.URL.RawQuery)

	if err != nil {
		app.handleErrorInternal(err, w)
	}

	namespace := vals["namespace"][0]
	clusterId, err := strconv.ParseUint(vals["cluster_id"][0], 0, 64)

	if err != nil {
		app.handleErrorInternal(err, w)
		return
	}

	rel, err := app.Repo.Release.ReadRelease(uint(clusterId), name, namespace)

	if err != nil {
		app.sendExternalError(err, http.StatusNotFound, HTTPError{
			Code:   ErrReleaseReadData,
			Errors: []string{"release not found"},
		}, w)

		return
	}

	res := make([]models.SubEventExternal, 0)

	if rel.EventContainer != 0 {
		subevents, err := app.Repo.Event.ReadEventsByContainerID(rel.EventContainer)

		if err != nil {
			app.handleErrorInternal(err, w)
		}

		for _, sub := range subevents {
			res = append(res, sub.Externalize())
		}
	}

	json.NewEncoder(w).Encode(res)
}

type HandleUpdateReleaseStepsForm struct {
	Event struct {
		ID     string             `json:"event_id" form:"required"`
		Name   string             `json:"name" form:"required"`
		Index  int64              `json:"index" form:"required"`
		Status models.EventStatus `json:"status" form:"required"`
		Info   string             `json:"info" form:"required"`
	} `json:"event" form:"required"`
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	ClusterID uint   `json:"cluster_id"`
}

// HandleUpdateReleaseSteps adds a new step to a release
func (app *App) HandleUpdateReleaseSteps(w http.ResponseWriter, r *http.Request) {
	form := &HandleUpdateReleaseStepsForm{}

	if err := json.NewDecoder(r.Body).Decode(form); err != nil {
		app.handleErrorInternal(err, w)
		return
	}

	rel, err := app.Repo.Release.ReadRelease(form.ClusterID, form.Name, form.Namespace)

	if err != nil {
		app.sendExternalError(err, http.StatusInternalServerError, HTTPError{
			Code:   ErrReleaseReadData,
			Errors: []string{"Release not found"},
		}, w)

		return
	}

	if rel.EventContainer == 0 {
		// create new event container
		container, err := app.Repo.Event.CreateEventContainer(&models.EventContainer{ReleaseID: rel.ID})
		if err != nil {
			app.handleErrorDataWrite(err, w)
			return
		}

		rel.EventContainer = container.ID

		rel, err = app.Repo.Release.UpdateRelease(rel)

		if err != nil {
			app.handleErrorInternal(err, w)
			return
		}

	}

	container, err := app.Repo.Event.ReadEventContainer(rel.EventContainer)

	if err != nil {
		app.handleErrorInternal(err, w)
		return
	}

	if err := app.Repo.Event.AppendEvent(container, &models.SubEvent{
		EventContainerID: container.ID,
		EventID:          form.Event.ID,
		Name:             form.Event.Name,
		Index:            form.Event.Index,
		Status:           form.Event.Status,
		Info:             form.Event.Info,
	}); err != nil {
		app.handleErrorInternal(err, w)
	}

}

// ------------------------ Release handler helper functions ------------------------ //

// getAgentFromQueryParams uses the query params to populate a form, and then
// passes that form to the underlying app.getAgentFromReleaseForm to create a new
// Helm agent.
func (app *App) getAgentFromQueryParams(
	w http.ResponseWriter,
	r *http.Request,
	form *forms.ReleaseForm,
	// populate uses the query params to populate a form
	populate ...func(vals url.Values, repo repository.ClusterRepository) error,
) (*helm.Agent, error) {
	vals, err := url.ParseQuery(r.URL.RawQuery)

	if err != nil {
		app.handleErrorFormDecoding(err, ErrReleaseDecode, w)
		return nil, err
	}

	for _, f := range populate {
		err := f(vals, app.Repo.Cluster)

		if err != nil {
			app.handleErrorInternal(err, w)
			return nil, err
		}
	}

	return app.getAgentFromReleaseForm(w, r, form)
}

// getAgentFromReleaseForm uses a non-validated form to construct a new Helm agent based on
// the userID found in the session and the options required by the Helm agent.
func (app *App) getAgentFromReleaseForm(
	w http.ResponseWriter,
	r *http.Request,
	form *forms.ReleaseForm,
) (*helm.Agent, error) {
	var err error

	// validate the form
	if err := app.validator.Struct(form); err != nil {
		app.handleErrorFormValidation(err, ErrReleaseValidateFields, w)
		return nil, err
	}

	// create a new agent
	var agent *helm.Agent

	if app.ServerConf.IsTesting {
		agent = app.TestAgents.HelmAgent
	} else {
		agent, err = helm.GetAgentOutOfClusterConfig(form.Form, app.Logger)
	}

	if err != nil {
		app.handleErrorInternal(err, w)
	}

	return agent, err
}

const veleroForm string = `tags:
- hello
tabs:
- name: main
  context:
    type: cluster
    config:
      group: velero.io
      version: v1
      resource: backups
  label: Backups
  sections:
  - name: section_one
    contents: 
    - type: heading
      label: 💾 Velero Backups
    - type: resource-list
      value: |
        .items[] | { 
          name: .metadata.name, 
          label: .metadata.namespace,
          status: .status.phase,
          timestamp: .status.completionTimestamp,
          message: [
            (if .status.volumeSnapshotsAttempted then "\(.status.volumeSnapshotsAttempted) volume snapshots attempted, \(.status.volumeSnapshotsCompleted) completed." else null end),
            "Finished \(.status.completionTimestamp).",
            "Backup expires on \(.status.expiration)."
          ]|join(" "),
          data: {
            "Included Namespaces": (if .spec.includedNamespaces then .spec.includedNamespaces|join(",") else "* (all)" end),
            "Included Resources": (if .spec.includedResources then .spec.includedResources|join(",") else "* (all)" end),
            "Storage Location": .spec.storageLocation
          }
        }`
