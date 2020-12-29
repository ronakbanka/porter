import React, { Component } from 'react';
import styled from 'styled-components';
import gradient from '../../../assets/gradient.jpg';
import awsWhite from '../../../assets/aws-white.png';
import close from '../../../assets/close.png';

import { Context } from '../../../shared/Context';
import { integrationList } from '../../../shared/common';
import InputRow from '../../../components/values-form/InputRow';
import Helper from '../../../components/values-form/Helper';
import Heading from '../../../components/values-form/Heading';
import api from '../../../shared/api';
import Loading from '../../../components/Loading';
import SaveButton from '../../../components/SaveButton';

const providers = ['aws', 'gcp', 'do',];

type PropsType = {
  setCurrentView: (x: string) => void,
};

type StateType = {
  projectName: string,
  selectedProvider: string | null,
  awsAccessId: string | null,
  awsSecretKey: string | null,
  status: string | null,
};

export default class NewProject extends Component<PropsType, StateType> {
  state = {
    projectName: '',
    selectedProvider: null as string | null,
    awsAccessId: '' as string | null,
    awsSecretKey: '' as string | null,
    status: null as string | null,
  }

  isAlphanumeric = (x: string) => {
    let re = /^[a-z0-9-]+$/;
    if (x.length == 0 || x.search(re) === -1) {
      return false;
    }
    return true;
  }

  renderTemplateList = () => {
    return providers.map((provider: string, i: number) => {
      let providerInfo = integrationList[provider];
      return (
        <Block 
          key={i} 
          onClick={() => this.setState({ selectedProvider: provider })}
        >
          <Icon src={providerInfo.icon} />
          <BlockTitle>
            {providerInfo.label}
          </BlockTitle>
          <BlockDescription>
            Hosted in your own cloud.
          </BlockDescription>
        </Block>
      )
    });
  }

  renderProvisioners = () => {
    if (this.state.selectedProvider === 'aws') {
      return (
        <FormSection>
          <CloseButton onClick={() => {
            this.setState({ selectedProvider: null });
          }}>
            <CloseButtonImg src={close} />
          </CloseButton>
          <DarkMatter />
          <Heading>AWS Credentials</Heading>
          <InputRow
            type='text'
            value={this.state.awsAccessId}
            setValue={(x: string) => this.setState({ awsAccessId: x })}
            label='👤 AWS Access ID'
            placeholder='ex: AKIAIOSFODNN7EXAMPLE'
            width='100%'
            isRequired={true}
          />
          <InputRow
            type='password'
            value={this.state.awsSecretKey}
            setValue={(x: string) => this.setState({ awsSecretKey: x })}
            label='🔒 AWS Secret Key'
            placeholder='○ ○ ○ ○ ○ ○ ○ ○ ○'
            width='100%'
            isRequired={true}
          />
        </FormSection>
      );
    } else if (this.state.selectedProvider === 'gcp') {
      return (
        <FormSection>
          <CloseButton onClick={() => {
            this.setState({ selectedProvider: null });
          }}>
            <CloseButtonImg src={close} />
          </CloseButton>
          <Flex>
            GCP support is in closed beta. If you would like to run Porter in your own Google Cloud account, contact <Highlight>contact@getporter.dev</Highlight>.
          </Flex>
        </FormSection>
      );
    } else if (this.state.selectedProvider === 'do') {
      return (
        <FormSection>
          <CloseButton onClick={() => {
            this.setState({ selectedProvider: null });
          }}>
            <CloseButtonImg src={close} />
          </CloseButton>
          <Flex>
            DigitalOcean support is in closed beta. If you would like to run Porter in your own DO account, contact <Highlight>contact@getporter.dev</Highlight>.
          </Flex>
        </FormSection>
      );
    }

    return (
      <BlockList>
        {this.renderTemplateList()}
      </BlockList>
    );
  }

  renderHostingSection = () => {
    if (this.state.selectedProvider === 'skipped') {
      return (
        <>
          <Helper>Select your hosting backend:</Helper>
          <Placeholder>
            You can manually link to an existing cluster once this project has been created.
          </Placeholder>
          <Helper>
            Don't have a Kubernetes cluster?
            <Highlight onClick={() => this.setState({ selectedProvider: null })}>
              Provision through Porter
            </Highlight>
          </Helper>
        </>
      )
    }

    return (
      <>
        <Helper>
          Select your hosting backend: <Required>*</Required>
        </Helper>
        {this.renderProvisioners()}
        <Helper>
          Already have a Kubernetes cluster? 
          <Highlight onClick={() => this.setState({ selectedProvider: 'skipped' })}>
            Skip
          </Highlight>
        </Helper>
      </>
    )
  }

  validateForm = () => {
    let { projectName, selectedProvider, awsAccessId, awsSecretKey } = this.state;
    if (!this.isAlphanumeric(projectName) || projectName === '') {
      return false;
    } else if (selectedProvider === 'aws') {
      return awsAccessId !== '' && awsSecretKey !== '';
    }  else if (selectedProvider === 'skipped') {
      return true;
    }
    return false;
  }

  createProject = () => {
    this.setState({ status: 'loading' });
    api.createProject('<token>', {
      name: this.state.projectName
    }, {}, (err: any, res: any) => {
      if (err) {
        console.log(err);
      } else {
        let { user } = this.context;
        api.getProjects('<token>', {}, { id: user.userId }, (err: any, res: any) => {
          if (err) {
            console.log(err)
          } else if (res.data) {
            if (res.data.length > 0) {
              this.context.setCurrentProject(res.data[0]);
              this.props.setCurrentView('dashboard');
            } 
          }
        });
      }
    });
  }
  
  render() {
    return (
      <StyledNewProject>
        <TitleSection>
          <Title>New Project</Title>
        </TitleSection>

        <Helper>
          Project name
          <Warning highlight={!this.isAlphanumeric(this.state.projectName) && this.state.projectName !== ''}>
            (lowercase letters, numbers, and "-" only)
          </Warning>
          <Required>*</Required>
        </Helper>
        <InputWrapper>
          <ProjectIcon>
            <ProjectImage src={gradient} />
            <Letter>{this.state.projectName ? this.state.projectName[0].toUpperCase() : '-'}</Letter>
          </ProjectIcon>
          <InputRow
            type='string'
            value={this.state.projectName}
            setValue={(x: string) => this.setState({ projectName: x })}
            placeholder='ex: perspective-vortex'
            width='470px'
          />
        </InputWrapper>

        {this.renderHostingSection()}

        <SaveButton
          text='Create Project'
          disabled={!this.validateForm()}
          onClick={this.createProject}
          makeFlush={true}
          helper='Note: Provisioning can take up to 15 minutes'
          status={this.state.status}
        />
      </StyledNewProject>
    );
  }
}

NewProject.contextType = Context;

const Flex = styled.div`
  display: flex;
  height: 170px;
  width: 100%;
  margin-top: -10px;
  color: #ffffff;
  align-items: center;
  justify-content: center;
`;

const BlockOverlay = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  background: #00000055;
  top: 0;
  left: 0;
`;

const CloseButton = styled.div`
  position: absolute;
  display: block;
  width: 40px;
  height: 40px;
  padding: 13px 0 12px 0;
  z-index: 1;
  text-align: center;
  border-radius: 50%;
  right: 15px;
  top: 12px;
  cursor: pointer;
  :hover {
    background-color: #ffffff11;
  }
`;

const CloseButtonImg = styled.img`
  width: 14px;
  margin: 0 auto;
`;

const DarkMatter = styled.div`
  margin-top: -30px;
`;

const FormSection = styled.div`
  background: #ffffff11;
  margin-top: 25px;
  margin-bottom: 27px;
  background: #26282f;
  border-radius: 5px;
  min-height: 170px;
  padding: 25px;
  padding-bottom: 15px;
  font-size: 13px;
  animation: fadeIn 0.3s 0s;
  position: relative;
`;

const Placeholder = styled.div`
  background: #ffffff11;
  margin-top: 25px;
  margin-bottom: 27px;
  background: #26282f;
  border-radius: 5px;
  height: 170px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff44;
  font-size: 13px;
`;

const Required = styled.div`
  margin-left: 8px;
  color: #fc4976;
`;

const Highlight = styled.div`
  margin-left: 5px;
  color: #8590ff;
  cursor: pointer;
`;

const Letter = styled.div`
  height: 100%;
  width: 100%;
  position: absolute;
  background: #00000028;
  top: 0;
  left: 0;
  display: flex;
  color: white;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 500;
  font-family: 'Work Sans', sans-serif;
`;

const ProjectImage = styled.img`
  width: 100%;
  height: 100%;
`;

const ProjectIcon = styled.div`
  width: 45px;
  min-width: 45px;
  height: 45px;
  border-radius: 5px;
  overflow: hidden;
  position: relative;
  margin-right: 15px;
  font-weight: 400;
  margin-top: 17px;
`;

const InputWrapper = styled.div`
  display: flex;
  align-items: center;
  margin-top: -15px;
`;

const Warning = styled.span`
  color: ${(props: { highlight: boolean }) => props.highlight ? '#f5cb42' : ''};
  margin-left: 5px;
`;

const Icon = styled.img`
  height: 42px;
  margin-top: 30px;
  margin-bottom: 15px;
  filter: ${(props: { bw?: boolean }) => props.bw ? 'grayscale(1)' : ''};
`;

const BlockDescription = styled.div`
  margin-bottom: 12px;
  color: #ffffff66;
  text-align: center;
  font-weight: default;
  font-size: 13px;
  padding: 0px 25px;
  height: 2.4em;
  font-size: 12px;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;  
`;

const BlockTitle = styled.div`
  margin-bottom: 12px;
  width: 80%;
  text-align: center;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Block = styled.div`
  align-items: center;
  user-select: none;
  border-radius: 5px;
  display: flex;
  font-size: 13px;
  overflow: hidden;
  font-weight: 500;
  padding: 3px 0px 5px;
  flex-direction: column;
  align-item: center;
  justify-content: space-between;
  height: 170px;
  cursor: ${(props: { disabled?: boolean }) => props.disabled ? '' : 'pointer'};
  color: #ffffff;
  position: relative;
  background: #26282f;
  box-shadow: 0 3px 5px 0px #00000022;
  :hover {
    background: ${(props: { disabled?: boolean }) => props.disabled ? '' : '#ffffff11'};
  }

  animation: fadeIn 0.3s 0s;
  @keyframes fadeIn {
    from { opacity: 0 }
    to { opacity: 1 }
  }
`;

const ShinyBlock = styled(Block)`
  background: linear-gradient(36deg, rgba(240,106,40,0.9) 0%, rgba(229,83,229,0.9) 100%);
  :hover {
    background: linear-gradient(36deg, rgba(240,106,40,1) 0%, rgba(229,83,229,1) 100%);
  }
`;

const BlockList = styled.div`
  overflow: visible;
  margin-top: 25px;
  margin-bottom: 27px;
  display: grid;
  grid-column-gap: 25px;
  grid-row-gap: 25px;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
`;

const Title = styled.div`
  font-size: 24px;
  font-weight: 600;
  font-family: 'Work Sans', sans-serif;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TitleSection = styled.div`
  margin-bottom: 20px;
  display: flex;
  flex-direction: row;
  align-items: center;

  > a {
    > i {
      display: flex;
      align-items: center;
      margin-bottom: -2px;
      font-size: 18px;
      margin-left: 18px;
      color: #858FAAaa;
      cursor: pointer;
      :hover {
        color: #aaaabb;
      }
    }
  }
`;

const StyledNewProject = styled.div`
  width: calc(90% - 150px);
  min-width: 300px;
  height: 600px;
  position: relative;
  padding-top: 50px;
  margin-top: calc(50vh - 350px);
`;
