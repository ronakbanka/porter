import axios from 'axios';
import { baseApi } from './baseApi';

import { StorageType } from './types';

/**
 * Generic api call format
 * @param {string} token - Bearer token.
 * @param {Object} params - Body params.
 * @param {Object} pathParams - Path params.
 * @param {(err: Object, res: Object) => void} callback - Callback function.
 */

const checkAuth = baseApi('GET', '/api/auth/check');

const registerUser = baseApi<{ 
  email: string,
  password: string
}>('POST', '/api/users');

const logInUser = baseApi<{
  email: string,
  password: string
}>('POST', '/api/login');

const logOutUser = baseApi('POST', '/api/logout');

const getUser = baseApi<{}, { id: number }>('GET', pathParams => {
  return `/api/users/${pathParams.id}`;
});

const updateUser = baseApi<{
  rawKubeConfig?: string,
  allowedContexts?: string[]
}, { id: number }>('PUT', pathParams => {
  return `/api/users/${pathParams.id}`;
});

const getClusters = baseApi<{}, { id: number }>('GET', pathParams => {
  return `/api/projects/${pathParams.id}/clusters`;
});

const getCharts = baseApi<{
  namespace: string,
  cluster_id: number,
  storage: StorageType,
  limit: number,
  skip: number,
  byDate: boolean,
  statusFilter: string[]
}, { id: number }>('GET', pathParams => {
  return `/api/projects/${pathParams.id}/releases`;
});

const getChart = baseApi<{
  namespace: string,
  cluster_id: number,
  storage: StorageType
}, { id: number, name: string, revision: number }>('GET', pathParams => {
  return `/api/projects/${pathParams.id}/releases/${pathParams.name}/${pathParams.revision}`;
});

const getChartComponents = baseApi<{
  namespace: string,
  cluster_id: number,
  storage: StorageType
}, { id: number, name: string, revision: number }>('GET', pathParams => {
  return `/api/projects/${pathParams.id}/releases/${pathParams.name}/${pathParams.revision}/components`;
});

const getChartControllers = baseApi<{
  namespace: string,
  cluster_id: number,
  storage: StorageType
}, { id: number, name: string, revision: number }>('GET', pathParams => {
  return `/api/projects/${pathParams.id}/releases/${pathParams.name}/${pathParams.revision}/controllers`;
});

const getNamespaces = baseApi<{
  cluster_id: number,
}, { id: number }>('GET', pathParams => {
  return `/api/projects/${pathParams.id}/k8s/namespaces`;
});

const getMatchingPods = baseApi<{
  cluster_id: number,
  selectors: string[]
}, { id: number }>('GET', pathParams => {
  return `/api/projects/${pathParams.id}/k8s/pods`;
});

const getIngress = baseApi<{
  cluster_id: number,
}, { name: string, namespace: string, id: number }>('GET', pathParams => {
  return `/api/projects/${pathParams.id}/k8s/${pathParams.namespace}/ingress/${pathParams.name}`;
});

const getInvites = baseApi<{}, { id: number }>('GET', pathParams => {
  return `/api/projects/${pathParams.id}/invites`;
});

const getRevisions = baseApi<{
  namespace: string,
  cluster_id: number,
  storage: StorageType
}, { id: number, name: string }>('GET', pathParams => {
  return `/api/projects/${pathParams.id}/releases/${pathParams.name}/history`;
});

const rollbackChart = baseApi<{
  namespace: string,
  storage: StorageType,
  revision: number
}, {
  id: number,
  name: string,
  cluster_id: number,
}>('POST', pathParams => {
  let { id, name, cluster_id } = pathParams;
  return `/api/projects/${id}/releases/${name}/rollback?cluster_id=${cluster_id}`;
});

const upgradeChartValues = baseApi<{
  namespace: string,
  storage: StorageType,
  values: string
}, {
  id: number,
  name: string,
  cluster_id: number,
}>('POST', pathParams => {
  let { id, name, cluster_id } = pathParams;
  return `/api/projects/${id}/releases/${name}/upgrade?cluster_id=${cluster_id}`;
});

const getTemplates = baseApi('GET', '/api/templates');

const getTemplateInfo = baseApi<{}, { name: string, version: string }>('GET', pathParams => {
  return `/api/templates/${pathParams.name}/${pathParams.version}`;
});

const getRepos = baseApi<{}, { id: number }>('GET', pathParams => {
  return `/api/projects/${pathParams.id}/repos`;
});

const getBranches = baseApi<{}, { kind: string, repo: string }>('GET', pathParams => {
  return `/api/repos/${pathParams.kind}/${pathParams.repo}/branches`;
});

const getBranchContents = baseApi<{ 
  dir: string 
}, {
  kind: string,
  repo: string,
  branch: string
}>('GET', pathParams => {
  return `/api/repos/github/${pathParams.repo}/${pathParams.branch}/contents`;
});

const getProjects = baseApi<{}, { id: number }>('GET', pathParams => {
  return `/api/users/${pathParams.id}/projects`;
});

const getReleaseToken = baseApi<{ 
  namespace: string,
  cluster_id: number,
  storage: StorageType,
}, { name: string, id: number }>('GET', pathParams => {
  return `/api/projects/${pathParams.id}/releases/${pathParams.name}/webhook_token`;
});

const createProject = baseApi<{ name: string }, {}>('POST', pathParams => {
  return `/api/projects`;
});

const deleteProject = baseApi<{}, { id: number }>('DELETE', pathParams => {
  return `/api/projects/${pathParams.id}`;
});

const deleteInvite = baseApi<{}, { id: number, invId: number }>('DELETE', pathParams => {
  return `/api/projects/${pathParams.id}/invites/${pathParams.invId}`;
});

const deployTemplate = baseApi<{
  templateName: string,
  imageURL?: string,
  formValues?: any,
  storage: StorageType,
  namespace: string,
  name: string,
}, { 
  id: number,
  cluster_id: number, 
  name: string, 
  version: string 
}>('POST', pathParams => {
  let { cluster_id, id, name, version } = pathParams;
  return `/api/projects/${id}/deploy/${name}/${version}?cluster_id=${cluster_id}`;
});

const uninstallTemplate = baseApi<{
}, {
  id: number,
  name: string, 
  cluster_id: number,
  namespace: string,
  storage: StorageType,
}>('POST', pathParams => {
  let { id, name, cluster_id, storage, namespace } = pathParams;
  return `/api/projects/${id}/deploy/${name}?cluster_id=${cluster_id}&namespace=${namespace}&storage=${storage}`;
});

const getClusterIntegrations = baseApi('GET', '/api/integrations/cluster');

const getRegistryIntegrations = baseApi('GET', '/api/integrations/registry');

const getRepoIntegrations = baseApi('GET', '/api/integrations/repo');

const getProjectClusters = baseApi<{}, { id: number }>('GET', pathParams => {
  return `/api/projects/${pathParams.id}/clusters`;
});

const getProjectRegistries = baseApi<{}, { id: number }>('GET', pathParams => {
  return `/api/projects/${pathParams.id}/registries`;
});

const getProjectRepos = baseApi<{}, { id: number }>('GET', pathParams => {
  return `/api/projects/${pathParams.id}/repos`;
});

const createAWSIntegration = baseApi<{
  aws_region: string,
  aws_cluster_id?: string,
  aws_access_key_id: string,
  aws_secret_access_key: string,
}, { id: number }>('POST', pathParams => {
  return `/api/projects/${pathParams.id}/integrations/aws`;
});

const provisionECR = baseApi<{
  ecr_name: string,
  aws_integration_id: string,
}, { id: number }>('POST', pathParams => {
  return `/api/projects/${pathParams.id}/provision/ecr`;
});

const provisionEKS = baseApi<{
  eks_name: string,
  aws_integration_id: string,
}, { id: number }>('POST', pathParams => {
  return `/api/projects/${pathParams.id}/provision/eks`;
});

const createECR = baseApi<{
  name: string,
  aws_integration_id: string,
}, { id: number }>('POST', pathParams => {
  return `/api/projects/${pathParams.id}/registries`;
});

const getImageRepos = baseApi<{
}, {
  project_id: number, 
  registry_id: number 
}>('GET', pathParams => {
  return `/api/projects/${pathParams.project_id}/registries/${pathParams.registry_id}/repositories`;
});

const getImageTags = baseApi<{
}, {   
  project_id: number,
  registry_id: number,
  repo_name: string,
}>('GET', pathParams => {
  return `/api/projects/${pathParams.project_id}/registries/${pathParams.registry_id}/repositories/${pathParams.repo_name}`;
});

const linkGithubProject = baseApi<{
}, {
  project_id: number,
}>('GET', pathParams => {
  return `/api/oauth/projects/${pathParams.project_id}/github`;
});

const getGitRepos = baseApi<{  
}, {
  project_id: number,
}>('GET', pathParams => {
  return `/api/projects/${pathParams.project_id}/gitrepos`;
});

const getInfra = baseApi<{
}, {
  project_id: number,
}>('GET', pathParams => {
  return `/api/projects/${pathParams.project_id}/infra`;
});

const destroyEKS = baseApi<{
  eks_name: string,
}, {
  project_id: number,
  infra_id: number,
}>('POST', pathParams => {
  return `/api/projects/${pathParams.project_id}/infra/${pathParams.infra_id}/eks/destroy`;
});

const destroyGKE = baseApi<{
  gke_name: string,
}, {
  project_id: number,
  infra_id: number,
}>('POST', pathParams => {
  return `/api/projects/${pathParams.project_id}/infra/${pathParams.infra_id}/gke/destroy`;
});

const destroyDOKS = baseApi<{
  doks_name: string,
}, {
  project_id: number,
  infra_id: number,
}>('POST', pathParams => {
  return `/api/projects/${pathParams.project_id}/infra/${pathParams.infra_id}/doks/destroy`;
});

const deleteCluster = baseApi<{
}, {
  project_id: number,
  cluster_id: number,
}>('DELETE', pathParams => {
  return `/api/projects/${pathParams.project_id}/clusters/${pathParams.cluster_id}`;
});

const createGCPIntegration = baseApi<{
  gcp_region: string,
  gcp_key_data: string,
  gcp_project_id: string,
}, {
  project_id: number,
}>('POST', pathParams => {
  return `/api/projects/${pathParams.project_id}/integrations/gcp`;
});

const createGCR = baseApi<{
  gcp_integration_id: number,
}, {
  project_id: number,
}>('POST', pathParams => {
  return `/api/projects/${pathParams.project_id}/provision/gcr`;
});

const createGKE = baseApi<{
  gcp_integration_id: number,
  gke_name: string,
}, {
  project_id: number,
}>('POST', pathParams => {
  return `/api/projects/${pathParams.project_id}/provision/gke`;
});

const createInvite = baseApi<{
  email: string
}, {
  id: number
}>('POST', pathParams => {
  return `/api/projects/${pathParams.id}/invites`;
});

const getOAuthIds = baseApi<{
}, {
  project_id: number,
}>('GET', pathParams => {
  return `/api/projects/${pathParams.project_id}/integrations/oauth`;
});

const createDOCR = baseApi<{
  do_integration_id: number,
  docr_name: string,
  docr_subscription_tier: string,
}, {
  project_id: number,
}>('POST', pathParams => {
  return `/api/projects/${pathParams.project_id}/provision/docr`;
});

const createDOKS = baseApi<{
  do_integration_id: number,
  doks_name: string,
  do_region: string,
}, {
  project_id: number,
}>('POST', pathParams => {
  return `/api/projects/${pathParams.project_id}/provision/doks`;
});

// Bundle export to allow default api import (api.<method> is more readable)
export default {
  createDOKS,
  createDOCR,
  getOAuthIds,
  checkAuth,
  createAWSIntegration,
  createECR,
  createGCPIntegration,
  createGCR,
  createGKE,
  createInvite,
  createProject,
  deleteCluster,
  deleteInvite,
  deleteProject,
  deployTemplate,
  destroyEKS,
  destroyGKE,
  destroyDOKS,
  getBranchContents,
  getBranches,
  getChart,
  getCharts,
  getChartComponents,
  getChartControllers,
  getClusterIntegrations,
  getClusters,
  getGitRepos,
  getImageRepos,
  getImageTags,
  getInfra,
  getIngress,
  getInvites,
  getMatchingPods,
  getNamespaces,
  getProjectClusters,
  getProjectRegistries,
  getProjectRepos,
  getProjects,
  getRegistryIntegrations,
  getReleaseToken,
  getRepoIntegrations,
  getRepos,
  getRevisions,
  getTemplateInfo,
  getTemplates,
  getUser,
  linkGithubProject,
  logInUser,
  logOutUser,
  provisionECR,
  provisionEKS,
  registerUser,
  rollbackChart,
  uninstallTemplate,
  updateUser,
  upgradeChartValues,
}