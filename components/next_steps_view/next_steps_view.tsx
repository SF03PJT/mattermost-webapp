// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import classNames from 'classnames';
import {FormattedMessage} from 'react-intl';

import {PreferenceType} from 'mattermost-redux/types/preferences';
import {UserProfile} from 'mattermost-redux/types/users';

import {pageVisited, trackEvent} from 'actions/telemetry_actions';
import Accordion from 'components/accordion';
import Card from 'components/card/card';
import {getAnalyticsCategory} from 'components/next_steps_view/step_helpers';
import {Preferences, RecommendedNextSteps} from 'utils/constants';

import loadingIcon from 'images/spinner-48x48-blue.apng';

import {StepType} from './steps';
import './next_steps_view.scss';
import OnboardingBgSvg from './images/onboarding-bg-svg';
import GettingStartedSvg from './images/getting-started-svg';
import CloudLogoSvg from './images/cloud-logo-svg';
import LogoSvg from './images/logo-svg';
import OnboardingSuccessSvg from './images/onboarding-success-svg';

const TRANSITION_SCREEN_TIMEOUT = 3000;

type Props = {
    currentUser: UserProfile;
    preferences: PreferenceType[];
    isFirstAdmin: boolean;
    isAdmin: boolean;
    isMobileView: boolean;
    steps: StepType[];
    isCloud: boolean;
    actions: {
        savePreferences: (userId: string, preferences: PreferenceType[]) => void;
        setShowNextStepsView: (show: boolean) => void;
        closeRightHandSide: () => void;
        getProfiles: () => void;
        selectChannel: (channelId: string) => void;
    };
};

type State = {
    showTransitionScreen: boolean;
    animating: boolean;
    show: boolean;
}

export default class NextStepsView extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            showTransitionScreen: false,
            animating: false,
            show: false,
        };
    }

    async componentDidMount() {
        this.props.actions.selectChannel('');
        await this.props.actions.getProfiles();

        // eslint-disable-next-line react/no-did-mount-set-state
        this.setState({show: true});
        pageVisited(getAnalyticsCategory(this.props.isFirstAdmin), 'pageview_welcome');
        this.props.actions.closeRightHandSide();
    }

    getStartingStep = () => {
        for (let i = 0; i < this.props.steps.length; i++) {
            if (!this.isStepComplete(this.props.steps[i].id)) {
                return this.props.steps[i].id;
            }
        }
        return this.props.steps[0].id;
    }

    getIncompleteStep = () => {
        for (let i = 0; i < this.props.steps.length; i++) {
            if (!this.isStepComplete(this.props.steps[i].id)) {
                return this.props.steps[i].id;
            }
        }
        return null;
    }

    onClickHeader = (setExpanded: (expandedKey: string) => void, id: string) => {
        const stepIndex = this.getStepNumberFromId(id);
        trackEvent(getAnalyticsCategory(this.props.isFirstAdmin), `click_onboarding_step${stepIndex}`);
        setExpanded(id);
    }

    getStepNumberFromId = (id: string) => {
        return this.props.steps.findIndex((step) => step.id === id) + 1;
    }

    onSkip = (setExpanded: (expandedKey: string) => void) => {
        return (id: string) => {
            this.nextStep(setExpanded, id);
        };
    }

    onSkipAll = async () => {
        this.transitionOutOfOnboarding();
        setTimeout(() => {
            this.props.actions.savePreferences(this.props.currentUser.id, [{
                user_id: this.props.currentUser.id,
                category: Preferences.RECOMMENDED_NEXT_STEPS,
                name: RecommendedNextSteps.SKIP,
                value: 'true',
            }]);
        }, TRANSITION_SCREEN_TIMEOUT);
    }

    onFinish = (setExpanded: (expandedKey: string) => void, isLastStep: boolean) => {
        return async (id: string) => {
            const stepIndex = this.getStepNumberFromId(id);
            trackEvent(getAnalyticsCategory(this.props.isFirstAdmin), `complete_onboarding_step${stepIndex}`);

            if (isLastStep) {
                this.transitionOutOfOnboarding();
                setTimeout(() => {
                    this.props.actions.savePreferences(this.props.currentUser.id, [{
                        category: Preferences.RECOMMENDED_NEXT_STEPS,
                        user_id: this.props.currentUser.id,
                        name: id,
                        value: 'true',
                    }]);
                }, TRANSITION_SCREEN_TIMEOUT);
                return;
            }

            await this.props.actions.savePreferences(this.props.currentUser.id, [{
                category: Preferences.RECOMMENDED_NEXT_STEPS,
                user_id: this.props.currentUser.id,
                name: id,
                value: 'true',
            }]);

            this.nextStep(setExpanded, id);
        };
    }

    transitionOutOfOnboarding = () => {
        this.setState({showTransitionScreen: true, animating: true});
    }

    nextStep = (setExpanded: (expandedKey: string) => void, id: string) => {
        const currentIndex = this.props.steps.findIndex((step) => step.id === id);
        if (currentIndex + 1 > this.props.steps.length - 1) {
            // Check if previous steps were skipped before moving on
            const incompleteStep = this.getIncompleteStep();
            if (incompleteStep === null) {
                // Collapse all accordion tiles
                setExpanded('');
            } else {
                setExpanded(incompleteStep);
            }
        } else if (this.isStepComplete(this.props.steps[currentIndex + 1].id)) {
            this.nextStep(setExpanded, this.props.steps[currentIndex + 1].id);
        } else {
            setExpanded(this.props.steps[currentIndex + 1].id);
        }
    }

    isStepComplete = (id: string) => {
        return this.props.preferences.some((pref) => pref.name === id && pref.value === 'true');
    }

    renderStep = (step: StepType, index: number) => {
        const {id, title, completeStepButtonText} = step;

        let icon = (
            <div className='NextStepsView__cardHeaderBadge'>
                <span>{index + 1}</span>
            </div>
        );
        if (this.isStepComplete(id)) {
            icon = (
                <i className='icon icon-check-circle'/>
            );
        }

        return (setExpanded: (expandedKey: string) => void, expandedKey: string, lastNonCompletedStep: StepType) => (
            <Card
                className={classNames({complete: this.isStepComplete(id)})}
                expanded={expandedKey === id}
                key={`key_${id}_${index}`}
            >
                <Card.Header>
                    <button
                        onClick={() => this.onClickHeader(setExpanded, id)}
                        disabled={this.isStepComplete(id)}
                        className='NextStepsView__cardHeader'
                    >
                        {icon}
                        <FormattedMessage
                            id={title.titleId}
                            defaultMessage={title.titleMessage}
                        />
                    </button>
                </Card.Header>
                <Card.Body>
                    <step.component
                        id={id}
                        expanded={expandedKey === id}
                        isAdmin={this.props.isFirstAdmin}
                        isMobileView={this.props.isMobileView}
                        currentUser={this.props.currentUser}
                        onFinish={this.onFinish(setExpanded, lastNonCompletedStep?.id === id)}
                        onSkip={this.onSkip(setExpanded)}
                        isLastStep={lastNonCompletedStep?.id === id}
                        completeStepButtonText={completeStepButtonText}
                    />
                </Card.Body>
            </Card>
        );
    }

    renderTransitionScreen = () => {
        return (
            <div
                className={classNames('NextStepsView__viewWrapper NextStepsView__transitionView', {
                    transitioning: this.state.showTransitionScreen,
                    animating: this.state.animating,
                })}
            >
                <div className='NextStepsView__transitionBody'>
                    <OnboardingSuccessSvg/>
                    <h1 className='NextStepsView__transitionTopText'>
                        <FormattedMessage
                            id='next_steps_view.nicelyDone'
                            defaultMessage='Nicely done! You’re all set.'
                        />
                    </h1>
                    <p className='NextStepsView__transitionBottomText'>
                        <img src={loadingIcon}/>
                        <FormattedMessage
                            id='next_steps_view.oneMoment'
                            defaultMessage='One moment'
                        />
                    </p>
                </div>
            </div>
        );
    }

    renderMainBody = () => {
        const renderedSteps = this.props.steps.map(this.renderStep);
        const nonCompletedSteps = this.props.steps.filter((step) => !this.isStepComplete(step.id));

        let lastNonCompletedStep: StepType;
        if (nonCompletedSteps.length === 1) {
            lastNonCompletedStep = nonCompletedSteps[0];
        }

        const logo = this.props.isCloud ? <CloudLogoSvg/> : <LogoSvg/>;

        return (
            <div
                className={classNames('NextStepsView__viewWrapper NextStepsView__mainView', {
                    completed: this.state.showTransitionScreen,
                    animating: this.state.animating,
                })}
            >
                <header className='NextStepsView__header'>
                    <div className='NextStepsView__header-headerText'>
                        <h1 className='NextStepsView__header-headerTopText'>
                            <FormattedMessage
                                id='next_steps_view.welcomeToMattermost'
                                defaultMessage='Welcome to Mattermost'
                            />
                        </h1>
                        <h2 className='NextStepsView__header-headerBottomText'>
                            <FormattedMessage
                                id='next_steps_view.hereAreSomeNextSteps'
                                defaultMessage='Here are some recommended next steps to help you get started'
                            />
                        </h2>
                    </div>
                    <div className='NextStepsView__header-logo'>
                        {logo}
                    </div>
                </header>
                <div className='NextStepsView__body'>
                    <div className='NextStepsView__body-main'>
                        <Accordion defaultExpandedKey={this.getIncompleteStep() === null ? '' : this.getStartingStep()}>
                            {(setExpanded, expandedKey) => {
                                return (
                                    <>
                                        {renderedSteps.map((step) => step(setExpanded, expandedKey, lastNonCompletedStep))}
                                    </>
                                );
                            }}
                        </Accordion>
                        <div className='NextStepsView__skipGettingStarted'>
                            <button
                                className='NextStepsView__button tertiary'
                                onClick={this.onSkipAll}
                            >
                                <FormattedMessage
                                    id='next_steps_view.skipGettingStarted'
                                    defaultMessage='Skip Getting Started'
                                />
                            </button>
                        </div>
                    </div>
                    <div className='NextStepsView__body-graphic'>
                        <GettingStartedSvg/>
                    </div>
                </div>
            </div>
        );
    }

    render() {
        return (
            <section
                id='app-content'
                className='app__content NextStepsView'
            >
                {this.state.show &&
                <>
                    <OnboardingBgSvg/>
                    {this.renderMainBody()}
                    {this.renderTransitionScreen()}
                </>}
            </section>
        );
    }
}
