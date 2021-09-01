package forms

import (
	"github.com/porter-dev/porter/internal/models"
)

// CreateGitAction represents the accepted values for creating a
// github action integration
type CreateGitAction struct {
	Release *models.Release

	GitRepo        string `json:"git_repo" form:"required"`
	GitBranch      string `json:"branch"`
	ImageRepoURI   string `json:"image_repo_uri" form:"required"`
	DockerfilePath string `json:"dockerfile_path"`
	FolderPath     string `json:"folder_path"`
	GitRepoID      uint   `json:"git_repo_id" form:"required"`
	RegistryID     uint   `json:"registry_id"`

	ShouldCreateWorkflow bool `json:"should_create_workflow"`
	ShouldGenerateOnly   bool
}

// ToGitActionConfig converts the form to a gorm git action config model
func (ca *CreateGitAction) ToGitActionConfig(version string) (*models.GitActionConfig, error) {
	return &models.GitActionConfig{
		ReleaseID:            ca.Release.Model.ID,
		GitRepo:              ca.GitRepo,
		GitBranch:            ca.GitBranch,
		ImageRepoURI:         ca.ImageRepoURI,
		DockerfilePath:       ca.DockerfilePath,
		FolderPath:           ca.FolderPath,
		GithubInstallationID: ca.GitRepoID,
		IsInstallation:       true,
		Version:              version,
	}, nil
}

type CreateGitActionOptional struct {
	GitRepo              string `json:"git_repo"`
	GitBranch            string `json:"branch"`
	ImageRepoURI         string `json:"image_repo_uri"`
	DockerfilePath       string `json:"dockerfile_path"`
	FolderPath           string `json:"folder_path"`
	GitRepoID            uint   `json:"git_repo_id"`
	RegistryID           uint   `json:"registry_id"`
	ShouldCreateWorkflow bool   `json:"should_create_workflow"`
}
