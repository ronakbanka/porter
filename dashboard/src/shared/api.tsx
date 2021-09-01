import { baseApi } from "./baseApi";

import { FullActionConfigType, StorageType } from "./types";

/**
 * Generic api call format
 * @param {string} token - Bearer token.
 * @param {Object} params - Body params.
 * @param {Object} pathParams - Path params.
 * @param {(err: Object, res: Object) => void} callback - Callback function.
 */

const checkAuth = baseApi("GET", "/api/auth/check");

const connectECRRegistry = baseApi<
  {
    name: string;
    aws_integration_id: string;
  },
  { id: number }
>("POST", (pathParams) => {
  return `/api/projects/${pathParams.id}/registries`;
});

const connectGCRRegistry = baseApi<
  {
    name: string;
    gcp_integration_id: string;
    url: string;
  },
  { id: number }
>("POST", (pathParams) => {
  return `/api/projects/${pathParams.id}/registries`;
});

const createAWSIntegration = baseApi<
  {
    aws_region: string;
    aws_cluster_id?: string;
    aws_access_key_id: string;
    aws_secret_access_key: string;
  },
  { id: number }
>("POST", (pathParams) => {
  return `/api/projects/${pathParams.id}/integrations/aws`;
});

const overwriteAWSIntegration = baseApi<
  {
    aws_access_key_id: string;
    aws_secret_access_key: string;
  },
  {
    projectID: number;
    awsIntegrationID: number;
    cluster_id: number;
  }
>("POST", (pathParams) => {
  return `/api/projects/${pathParams.projectID}/integrations/aws/${pathParams.awsIntegrationID}/overwrite?cluster_id=${pathParams.cluster_id}`;
});

const createDOCR = baseApi<
  {
    do_integration_id: number;
    docr_name: string;
    docr_subscription_tier: string;
  },
  {
    project_id: number;
  }
>("POST", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/provision/docr`;
});

const createDOKS = baseApi<
  {
    do_integration_id: number;
    doks_name: string;
    do_region: string;
  },
  {
    project_id: number;
  }
>("POST", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/provision/doks`;
});

const createEmailVerification = baseApi<{}, {}>("POST", (pathParams) => {
  return `/api/email/verify/initiate`;
});

const createGCPIntegration = baseApi<
  {
    gcp_region: string;
    gcp_key_data: string;
    gcp_project_id: string;
  },
  {
    project_id: number;
  }
>("POST", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/integrations/gcp`;
});

const createGCR = baseApi<
  {
    gcp_integration_id: number;
  },
  {
    project_id: number;
  }
>("POST", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/provision/gcr`;
});

const createGKE = baseApi<
  {
    gcp_integration_id: number;
    gke_name: string;
  },
  {
    project_id: number;
  }
>("POST", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/provision/gke`;
});

const createInvite = baseApi<
  {
    email: string;
    kind: string;
  },
  {
    id: number;
  }
>("POST", (pathParams) => {
  return `/api/projects/${pathParams.id}/invites`;
});

const createPasswordReset = baseApi<
  {
    email: string;
  },
  {}
>("POST", (pathParams) => {
  return `/api/password/reset/initiate`;
});

const createPasswordResetVerify = baseApi<
  {
    email: string;
    token: string;
    token_id: number;
  },
  {}
>("POST", (pathParams) => {
  return `/api/password/reset/verify`;
});

const createPasswordResetFinalize = baseApi<
  {
    email: string;
    token: string;
    token_id: number;
    new_password: string;
  },
  {}
>("POST", (pathParams) => {
  return `/api/password/reset/finalize`;
});

const createProject = baseApi<{ name: string }, {}>("POST", (pathParams) => {
  return `/api/projects`;
});

const createSubdomain = baseApi<
  {
    release_name: string;
  },
  {
    id: number;
    cluster_id: number;
  }
>("POST", (pathParams) => {
  let { cluster_id, id } = pathParams;

  return `/api/projects/${id}/k8s/subdomain?cluster_id=${cluster_id}`;
});

const deleteCluster = baseApi<
  {},
  {
    project_id: number;
    cluster_id: number;
  }
>("DELETE", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/clusters/${pathParams.cluster_id}`;
});

const deleteInvite = baseApi<{}, { id: number; invId: number }>(
  "DELETE",
  (pathParams) => {
    return `/api/projects/${pathParams.id}/invites/${pathParams.invId}`;
  }
);

const deletePod = baseApi<
  {
    cluster_id: number;
  },
  { name: string; namespace: string; id: number }
>("DELETE", (pathParams) => {
  return `/api/projects/${pathParams.id}/k8s/pods/${pathParams.namespace}/${pathParams.name}`;
});

const getPodEvents = baseApi<
  {
    cluster_id: number;
  },
  { name: string; namespace: string; id: number }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/k8s/pods/${pathParams.namespace}/${pathParams.name}/events/list`;
});

const deleteProject = baseApi<{}, { id: number }>("DELETE", (pathParams) => {
  return `/api/projects/${pathParams.id}`;
});

const deleteRegistryIntegration = baseApi<
  {},
  {
    project_id: number;
    registry_id: number;
  }
>("DELETE", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/registries/${pathParams.registry_id}`;
});

const deleteSlackIntegration = baseApi<
  {},
  {
    project_id: number;
    slack_integration_id: number;
  }
>("DELETE", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/slack_integrations/${pathParams.slack_integration_id}`;
});

const updateNotificationConfig = baseApi<
  {
    payload: any;
    namespace: string;
    cluster_id: number;
  },
  {
    project_id: number;
    name: string;
  }
>("POST", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/releases/${pathParams.name}/notifications`;
});

const getNotificationConfig = baseApi<
  {
    namespace: string;
    cluster_id: number;
  },
  {
    project_id: number;
    name: string;
  }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/releases/${pathParams.name}/notifications`;
});

const generateGHAWorkflow = baseApi<
  FullActionConfigType,
  {
    cluster_id: number;
    project_id: number;
    name: string;
    namespace: string;
  }
>("POST", (pathParams) => {
  const { name, namespace, cluster_id, project_id } = pathParams;

  return `/api/projects/${project_id}/ci/actions/generate?cluster_id=${cluster_id}&name=${name}&namespace=${namespace}`;
});

const deployTemplate = baseApi<
  {
    templateName: string;
    imageURL?: string;
    formValues?: any;
    storage: StorageType;
    namespace: string;
    name: string;
    githubActionConfig?: FullActionConfigType;
  },
  {
    id: number;
    cluster_id: number;
    name: string;
    version: string;
    repo_url?: string;
  }
>("POST", (pathParams) => {
  let { cluster_id, id, name, version, repo_url } = pathParams;

  if (repo_url) {
    return `/api/projects/${id}/deploy/${name}/${version}?cluster_id=${cluster_id}&repo_url=${repo_url}`;
  }
  return `/api/projects/${id}/deploy/${name}/${version}?cluster_id=${cluster_id}`;
});

const deployAddon = baseApi<
  {
    templateName: string;
    formValues?: any;
    storage: StorageType;
    namespace: string;
    name: string;
  },
  {
    id: number;
    cluster_id: number;
    name: string;
    version: string;
    repo_url?: string;
  }
>("POST", (pathParams) => {
  let { cluster_id, id, name, version, repo_url } = pathParams;

  return `/api/projects/${id}/deploy/addon/${name}/${version}?cluster_id=${cluster_id}&repo_url=${repo_url}`;
});

const destroyCluster = baseApi<
  {
    eks_name: string;
  },
  {
    project_id: number;
    infra_id: number;
  }
>("POST", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/infra/${pathParams.infra_id}/eks/destroy`;
});

const detectBuildpack = baseApi<
  {},
  {
    project_id: number;
    git_repo_id: number;
    kind: string;
    owner: string;
    name: string;
    branch: string;
  }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/gitrepos/${
    pathParams.git_repo_id
  }/repos/${pathParams.kind}/${pathParams.owner}/${
    pathParams.name
  }/${encodeURIComponent(pathParams.branch)}/buildpack/detect`;
});

const getBranchContents = baseApi<
  {
    dir: string;
  },
  {
    project_id: number;
    git_repo_id: number;
    kind: string;
    owner: string;
    name: string;
    branch: string;
  }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/gitrepos/${
    pathParams.git_repo_id
  }/repos/${pathParams.kind}/${pathParams.owner}/${
    pathParams.name
  }/${encodeURIComponent(pathParams.branch)}/contents`;
});

const getProcfileContents = baseApi<
  {
    path: string;
  },
  {
    project_id: number;
    git_repo_id: number;
    kind: string;
    owner: string;
    name: string;
    branch: string;
  }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/gitrepos/${
    pathParams.git_repo_id
  }/repos/${pathParams.kind}/${pathParams.owner}/${
    pathParams.name
  }/${encodeURIComponent(pathParams.branch)}/procfile`;
});

const getBranches = baseApi<
  {},
  {
    project_id: number;
    git_repo_id: number;
    kind: string;
    owner: string;
    name: string;
  }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/gitrepos/${pathParams.git_repo_id}/repos/${pathParams.kind}/${pathParams.owner}/${pathParams.name}/branches`;
});

const getChart = baseApi<
  {
    namespace: string;
    cluster_id: number;
    storage: StorageType;
  },
  { id: number; name: string; revision: number }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/releases/${pathParams.name}/${pathParams.revision}`;
});

const getCharts = baseApi<
  {
    namespace: string;
    cluster_id: number;
    storage: StorageType;
    limit: number;
    skip: number;
    byDate: boolean;
    statusFilter: string[];
  },
  { id: number }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/releases`;
});

const getChartComponents = baseApi<
  {
    namespace: string;
    cluster_id: number;
    storage: StorageType;
  },
  { id: number; name: string; revision: number }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/releases/${pathParams.name}/${pathParams.revision}/components`;
});

const getChartControllers = baseApi<
  {
    namespace: string;
    cluster_id: number;
    storage: StorageType;
  },
  { id: number; name: string; revision: number }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/releases/${pathParams.name}/${pathParams.revision}/controllers`;
});

const getClusterIntegrations = baseApi("GET", "/api/integrations/cluster");

const getClusters = baseApi<{}, { id: number }>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/clusters`;
});

const getCluster = baseApi<
  {},
  {
    project_id: number;
    cluster_id: number;
  }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/clusters/${pathParams.cluster_id}`;
});

const getClusterNodes = baseApi<
  {},
  {
    project_id: number;
    cluster_id: number;
  }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/clusters/${pathParams.cluster_id}/nodes`;
});

const getClusterNode = baseApi<
  {},
  {
    project_id: number;
    cluster_id: number;
    nodeName: string;
  }
>(
  "GET",
  (pathParams) =>
    `/api/projects/${pathParams.project_id}/clusters/${pathParams.cluster_id}/node/${pathParams.nodeName}`
);

const getGitRepoList = baseApi<
  {},
  {
    project_id: number;
    git_repo_id: number;
  }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/gitrepos/${pathParams.git_repo_id}/repos`;
});

const getGitRepos = baseApi<
  {},
  {
    project_id: number;
  }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/gitrepos`;
});

const getImageRepos = baseApi<
  {},
  {
    project_id: number;
    registry_id: number;
  }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/registries/${pathParams.registry_id}/repositories`;
});

const getImageTags = baseApi<
  {},
  {
    project_id: number;
    registry_id: number;
    repo_name: string;
  }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/registries/${pathParams.registry_id}/repositories/${pathParams.repo_name}`;
});

const getInfra = baseApi<
  {},
  {
    project_id: number;
  }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/infra`;
});

const getIngress = baseApi<
  {
    cluster_id: number;
  },
  { name: string; namespace: string; id: number }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/k8s/${pathParams.namespace}/ingress/${pathParams.name}`;
});

const getInvites = baseApi<{}, { id: number }>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/invites`;
});

const getJobs = baseApi<
  {
    cluster_id: number;
  },
  { chart: string; namespace: string; release_name: string; id: number }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/k8s/${pathParams.namespace}/${pathParams.chart}/${pathParams.release_name}/jobs`;
});

const getJobStatus = baseApi<
  {
    cluster_id: number;
  },
  { name: string; namespace: string; id: number }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/k8s/${pathParams.namespace}/${pathParams.name}/jobs/status`;
});

const getJobPods = baseApi<
  {
    cluster_id: number;
  },
  { name: string; namespace: string; id: number }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/k8s/jobs/${pathParams.namespace}/${pathParams.name}/pods`;
});

const getMatchingPods = baseApi<
  {
    cluster_id: number;
    namespace: string;
    selectors: string[];
  },
  { id: number }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/k8s/pods`;
});

const getMetrics = baseApi<
  {
    cluster_id: number;
    metric: string;
    shouldsum: boolean;
    pods?: string[];
    kind?: string; // the controller kind
    name?: string;
    percentile?: number;
    namespace: string;
    startrange: number;
    endrange: number;
    resolution: string;
  },
  { id: number }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/k8s/metrics`;
});

const getNamespaces = baseApi<
  {
    cluster_id: number;
  },
  { id: number }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/k8s/namespaces`;
});

const getNGINXIngresses = baseApi<
  {
    cluster_id: number;
  },
  { id: number }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/k8s/prometheus/ingresses`;
});

const getOAuthIds = baseApi<
  {},
  {
    project_id: number;
  }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/integrations/oauth`;
});

const getProjectClusters = baseApi<{}, { id: number }>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/clusters`;
});

const getProjectRegistries = baseApi<{}, { id: number }>(
  "GET",
  (pathParams) => {
    return `/api/projects/${pathParams.id}/registries`;
  }
);

const getProjectRepos = baseApi<{}, { id: number }>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/repos`;
});

const getProjects = baseApi<{}, { id: number }>("GET", (pathParams) => {
  return `/api/users/${pathParams.id}/projects`;
});

const getPrometheusIsInstalled = baseApi<
  {
    cluster_id: number;
  },
  { id: number }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/k8s/prometheus/detect`;
});

const getRegistryIntegrations = baseApi("GET", "/api/integrations/registry");

const getReleaseToken = baseApi<
  {
    namespace: string;
    cluster_id: number;
    storage: StorageType;
  },
  { name: string; id: number }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/releases/${pathParams.name}/webhook_token`;
});

const getReleaseSteps = baseApi<
  {
    namespace: string;
    cluster_id: number;
  },
  { name: string; id: number }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/releases/${pathParams.name}/steps`;
});

const destroyEKS = baseApi<
  {
    eks_name: string;
  },
  {
    project_id: number;
    infra_id: number;
  }
>("POST", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/infra/${pathParams.infra_id}/eks/destroy`;
});

const destroyGKE = baseApi<
  {
    gke_name: string;
  },
  {
    project_id: number;
    infra_id: number;
  }
>("POST", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/infra/${pathParams.infra_id}/gke/destroy`;
});

const destroyDOKS = baseApi<
  {
    doks_name: string;
  },
  {
    project_id: number;
    infra_id: number;
  }
>("POST", (pathParams) => {
  return `/api/projects/${pathParams.project_id}/infra/${pathParams.infra_id}/doks/destroy`;
});

const getRepoIntegrations = baseApi("GET", "/api/integrations/repo");

const getRepos = baseApi<{}, { id: number }>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/repos`;
});

const getSlackIntegrations = baseApi<{}, { id: number }>(
  "GET",
  (pathParams) => {
    return `/api/projects/${pathParams.id}/slack_integrations`;
  }
);

const getRevisions = baseApi<
  {
    namespace: string;
    cluster_id: number;
    storage: StorageType;
  },
  { id: number; name: string }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/releases/${pathParams.name}/history`;
});

const getTemplateInfo = baseApi<
  {
    repo_url?: string;
  },
  { name: string; version: string }
>("GET", (pathParams) => {
  return `/api/templates/${pathParams.name}/${pathParams.version}`;
});

const getTemplateUpgradeNotes = baseApi<
  {
    repo_url?: string;
    prev_version: string;
  },
  { name: string; version: string }
>("GET", (pathParams) => {
  return `/api/templates/upgrade_notes/${pathParams.name}/${pathParams.version}`;
});

const getTemplates = baseApi<
  {
    repo_url?: string;
  },
  {}
>("GET", "/api/templates");

const getUser = baseApi<{}, { id: number }>("GET", (pathParams) => {
  return `/api/users/${pathParams.id}`;
});

const getCapabilities = baseApi<{}, {}>("GET", () => {
  return `/api/capabilities`;
});

const getWelcome = baseApi<{
  email: string,
  isCompany: boolean,
  company: string,
  role: string
}, {}>("GET", () => {
  return `/api/welcome`;
});

const linkGithubProject = baseApi<
  {},
  {
    project_id: number;
  }
>("GET", (pathParams) => {
  return `/api/oauth/projects/${pathParams.project_id}/github`;
});

const getGithubAccess = baseApi<{}, {}>("GET", () => {
  return `/api/integrations/github-app/access`;
});

const logInUser = baseApi<{
  email: string;
  password: string;
}>("POST", "/api/login");

const logOutUser = baseApi("POST", "/api/logout");

const provisionECR = baseApi<
  {
    ecr_name: string;
    aws_integration_id: string;
  },
  { id: number }
>("POST", (pathParams) => {
  return `/api/projects/${pathParams.id}/provision/ecr`;
});

const provisionEKS = baseApi<
  {
    eks_name: string;
    aws_integration_id: string;
    machine_type: string;
  },
  { id: number }
>("POST", (pathParams) => {
  return `/api/projects/${pathParams.id}/provision/eks`;
});

const registerUser = baseApi<{
  email: string;
  password: string;
}>("POST", "/api/users");

const rollbackChart = baseApi<
  {
    namespace: string;
    storage: StorageType;
    revision: number;
  },
  {
    id: number;
    name: string;
    cluster_id: number;
  }
>("POST", (pathParams) => {
  let { id, name, cluster_id } = pathParams;
  return `/api/projects/${id}/releases/${name}/rollback?cluster_id=${cluster_id}`;
});

const uninstallTemplate = baseApi<
  {},
  {
    id: number;
    name: string;
    cluster_id: number;
    namespace: string;
    storage: StorageType;
  }
>("POST", (pathParams) => {
  let { id, name, cluster_id, storage, namespace } = pathParams;
  return `/api/projects/${id}/delete/${name}?cluster_id=${cluster_id}&namespace=${namespace}&storage=${storage}`;
});

const updateUser = baseApi<
  {
    rawKubeConfig?: string;
    allowedContexts?: string[];
  },
  { id: number }
>("PUT", (pathParams) => {
  return `/api/users/${pathParams.id}`;
});

const upgradeChartValues = baseApi<
  {
    namespace: string;
    storage: StorageType;
    values: string;
    version?: string;
  },
  {
    id: number;
    name: string;
    cluster_id: number;
  }
>("POST", (pathParams) => {
  let { id, name, cluster_id } = pathParams;
  return `/api/projects/${id}/releases/${name}/upgrade?cluster_id=${cluster_id}`;
});

const listConfigMaps = baseApi<
  {
    namespace: string;
    cluster_id: number;
  },
  { id: number }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/k8s/configmap/list`;
});

const getConfigMap = baseApi<
  {
    name: string;
    namespace: string;
    cluster_id: number;
  },
  { id: number }
>("GET", (pathParams) => {
  return `/api/projects/${pathParams.id}/k8s/configmap`;
});

const createConfigMap = baseApi<
  {
    name: string;
    namespace: string;
    variables: Record<string, string>;
    secret_variables?: Record<string, string>;
  },
  { id: number; cluster_id: number }
>("POST", (pathParams) => {
  let { id, cluster_id } = pathParams;
  return `/api/projects/${id}/k8s/configmap/create?cluster_id=${cluster_id}`;
});

const updateConfigMap = baseApi<
  {
    name: string;
    namespace: string;
    variables: Record<string, string>;
    secret_variables?: Record<string, string>;
  },
  { id: number; cluster_id: number }
>("POST", (pathParams) => {
  let { id, cluster_id } = pathParams;
  return `/api/projects/${id}/k8s/configmap/update?cluster_id=${cluster_id}`;
});

const renameConfigMap = baseApi<
  {
    name: string;
    namespace: string;
    new_name: string;
  },
  { id: number; cluster_id: number }
>("POST", (pathParams) => {
  let { id, cluster_id } = pathParams;
  return `/api/projects/${id}/k8s/configmap/rename?cluster_id=${cluster_id}`;
});

const deleteConfigMap = baseApi<
  {
    name: string;
    namespace: string;
    cluster_id: number;
  },
  { id: number }
>("DELETE", (pathParams) => {
  return `/api/projects/${pathParams.id}/k8s/configmap/delete`;
});

const createNamespace = baseApi<
  {
    name: string;
  },
  { id: number; cluster_id: number }
>("POST", (pathParams) => {
  let { id, cluster_id } = pathParams;
  return `/api/projects/${id}/k8s/namespaces/create?cluster_id=${cluster_id}`;
});

const deleteNamespace = baseApi<
  {
    name: string;
    cluster_id: number;
  },
  { id: number }
>("DELETE", (pathParams) => {
  let { id } = pathParams;
  return `/api/projects/${id}/k8s/namespaces/delete`;
});

const deleteJob = baseApi<
  { cluster_id: number },
  { name: string; namespace: string; id: number }
>("DELETE", (pathParams) => {
  let { id, name, namespace } = pathParams;
  return `/api/projects/${id}/k8s/jobs/${namespace}/${name}`;
});

const stopJob = baseApi<
  {},
  { name: string; namespace: string; id: number; cluster_id: number }
>("POST", (pathParams) => {
  let { id, name, namespace, cluster_id } = pathParams;
  return `/api/projects/${id}/k8s/jobs/${namespace}/${name}/stop?cluster_id=${cluster_id}`;
});

const getAvailableRoles = baseApi<{}, { project_id: number }>(
  "GET",
  ({ project_id }) => `/api/projects/${project_id}/roles`
);

const updateInvite = baseApi<
  { kind: string },
  { project_id: number; invite_id: number }
>(
  "POST",
  ({ project_id, invite_id }) =>
    `/api/projects/${project_id}/invites/${invite_id}`
);

const getCollaborators = baseApi<{}, { project_id: number }>(
  "GET",
  ({ project_id }) => `/api/projects/${project_id}/collaborators`
);

const updateCollaborator = baseApi<
  { kind: string },
  { project_id: number; user_id: number }
>(
  "POST",
  ({ project_id, user_id }) => `/api/projects/${project_id}/roles/${user_id}`
);

const removeCollaborator = baseApi<{}, { project_id: number; user_id: number }>(
  "DELETE",
  ({ project_id, user_id }) => `/api/projects/${project_id}/roles/${user_id}`
);

const getPolicyDocument = baseApi<{}, { project_id: number }>(
  "GET",
  ({ project_id }) => `/api/projects/${project_id}/policy`
);

const createWebhookToken = baseApi<
  {},
  {
    project_id: number;
    chart_name: string;
    namespace: string;
    cluster_id: number;
    storage: StorageType;
  }
>(
  "POST",
  ({ project_id, chart_name, namespace, cluster_id, storage }) =>
    `/api/projects/${project_id}/releases/${chart_name}/webhook_token?namespace=${namespace}&cluster_id=${cluster_id}&storage=${storage}`
);

// Bundle export to allow default api import (api.<method> is more readable)
export default {
  checkAuth,
  connectECRRegistry,
  connectGCRRegistry,
  createAWSIntegration,
  overwriteAWSIntegration,
  createDOCR,
  createDOKS,
  createEmailVerification,
  createGCPIntegration,
  createGCR,
  createGKE,
  createInvite,
  createNamespace,
  createPasswordReset,
  createPasswordResetVerify,
  createPasswordResetFinalize,
  createProject,
  createConfigMap,
  deleteCluster,
  deleteConfigMap,
  deleteInvite,
  deleteNamespace,
  deletePod,
  deleteProject,
  deleteRegistryIntegration,
  deleteSlackIntegration,
  updateNotificationConfig,
  getNotificationConfig,
  createSubdomain,
  deployTemplate,
  deployAddon,
  destroyEKS,
  destroyGKE,
  destroyDOKS,
  detectBuildpack,
  getBranchContents,
  getBranches,
  getCapabilities,
  getWelcome,
  getChart,
  getCharts,
  getChartComponents,
  getChartControllers,
  getClusterIntegrations,
  getClusters,
  getCluster,
  getClusterNodes,
  getClusterNode,
  getConfigMap,
  generateGHAWorkflow,
  getGitRepoList,
  getGitRepos,
  getImageRepos,
  getImageTags,
  getInfra,
  getIngress,
  getInvites,
  getJobs,
  getJobStatus,
  getJobPods,
  getMatchingPods,
  getMetrics,
  getNamespaces,
  getNGINXIngresses,
  getOAuthIds,
  getPodEvents,
  getProcfileContents,
  getProjectClusters,
  getProjectRegistries,
  getProjectRepos,
  getProjects,
  getPrometheusIsInstalled,
  getRegistryIntegrations,
  getReleaseToken,
  getReleaseSteps,
  getRepoIntegrations,
  getSlackIntegrations,
  getRepos,
  getRevisions,
  getTemplateInfo,
  getTemplateUpgradeNotes,
  getTemplates,
  getUser,
  linkGithubProject,
  getGithubAccess,
  listConfigMaps,
  logInUser,
  logOutUser,
  provisionECR,
  provisionEKS,
  registerUser,
  rollbackChart,
  uninstallTemplate,
  updateUser,
  renameConfigMap,
  updateConfigMap,
  upgradeChartValues,
  deleteJob,
  stopJob,
  updateInvite,
  getAvailableRoles,
  getCollaborators,
  updateCollaborator,
  removeCollaborator,
  getPolicyDocument,
  createWebhookToken,
};
