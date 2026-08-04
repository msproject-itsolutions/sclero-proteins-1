'use client';

import React, { useState } from 'react';
import { ChevronRight, RotateCcw } from 'lucide-react';

export default function QuizComponent({ onComplete = () => {}, content }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [recommendation, setRecommendation] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);

  const steps = content?.steps || [];
  const recommendations = Object.fromEntries((content?.recommendations || []).map((item) => [item.key, item]));
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const handleSelectOption = (value) => {
    const newAnswers = {
      ...answers,
      [step.id]: value,
    };
    setAnswers(newAnswers);

    if (isLastStep) {
      // Generate recommendation
      const key = [
        newAnswers.goal,
        newAnswers.timeframe?.split('-')[0],
        newAnswers.lifestyle,
        newAnswers.preferences,
      ]
        .join('-');

      const rec =
        recommendations[key] ||
        recommendations[`${newAnswers.goal}-8-active-none`] ||
        content?.fallbackRecommendation;

      setRecommendation(rec);
      setIsCompleted(true);
    } else {
      // Move to next step
      setCurrentStep(currentStep + 1);
    }
  };

  const handleGoBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleReset = () => {
    setCurrentStep(0);
    setAnswers({});
    setRecommendation(null);
    setIsCompleted(false);
  };

  const handleAddToCart = () => {
    onComplete({ recommendation, answers });
  };

  if (!step && !isCompleted) return null;

  if (isCompleted) {
    return (
      <div className="rounded-lg border border-edge bg-surface p-8 text-center shadow-card">
        {/* Success Icon */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-success text-4xl">
            ✓
          </div>
        </div>

        {/* Recommendation */}
        <h2 className="mb-2 font-display text-2xl font-medium text-ink-primary">{content.resultTitle}</h2>
        <p className="mb-6 text-sm text-ink-muted">
          {content.resultDescription}
        </p>

        {/* Product Card */}
        <div className="mb-6 rounded-md border border-edge bg-surface p-6 shadow-card">
          <div className="mb-4 text-center">
            <span className="inline-block rounded-xs bg-surface-muted px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-accent">
              {recommendation.match} {content.matchLabel}
            </span>
          </div>

          <h3 className="mb-2 font-display text-xl font-medium text-ink-primary">{recommendation.name}</h3>
          <p className="mb-4 text-sm text-ink-muted">{recommendation.reason}</p>

          <button
            onClick={handleAddToCart}
            className="btn-primary mb-2 w-full px-6 py-3 text-sm"
          >
            {content.addToCartLabel}
          </button>
          <button
            onClick={handleReset}
            className="btn-ghost flex w-full items-center justify-center gap-2 px-6 py-3 text-sm"
          >
            <RotateCcw className="h-4 w-4" />
            {content.startOverLabel}
          </button>
        </div>

        {/* Your Answers Summary */}
        <div className="rounded-md bg-surface-muted p-4 text-left">
          <p className="kicker mb-3">{content.preferencesLabel}</p>
          <div className="space-y-2 text-xs">
            {Object.entries(answers).map(([key, value]) => {
              const stepData = steps.find((s) => s.id === key);
              const option = stepData?.options.find((o) => o.value === value);
              return (
                <div key={key} className="flex justify-between">
                  <span className="text-ink-muted">{stepData?.title}:</span>
                  <span className="font-semibold text-ink-primary">{option?.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-edge bg-surface p-8 shadow-card">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="mb-2 flex justify-between text-xs font-medium text-ink-muted">
          <span>{content.questionLabel} {currentStep + 1}</span>
          <span>{currentStep + 1} {content.ofLabel} {steps.length}</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-edge-subtle">
          <div
            className="h-full bg-ink-primary transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <h2 className="mb-2 font-display text-2xl font-medium text-ink-primary">{step.title}</h2>
      <p className="mb-6 text-sm text-ink-muted">{step.subtitle}</p>

      {/* Options */}
      <div className="mb-8 space-y-3">
        {step.options.map((option) => (
          <button
            key={option.value}
            onClick={() => handleSelectOption(option.value)}
            className={`w-full rounded-md border p-4 text-left transition-all duration-300 ${
              answers[step.id] === option.value
                ? 'border-ink-primary bg-surface shadow-card'
                : 'border-edge bg-surface hover:border-edge-strong hover:shadow-card'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-semibold text-ink-primary">{option.label}</div>
                <div className="text-xs text-ink-muted">{option.description}</div>
              </div>
              <span className="ml-3 text-2xl">{option.icon}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={handleGoBack}
          disabled={currentStep === 0}
          className="btn-ghost flex-1 px-6 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {content.backLabel}
        </button>
        <button
          onClick={() => handleSelectOption(answers[step.id])}
          disabled={!answers[step.id]}
          className="btn-primary flex-1 flex items-center justify-center gap-2 px-6 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLastStep ? content.recommendationLabel : content.nextLabel}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
