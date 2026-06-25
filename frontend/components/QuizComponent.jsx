'use client';

import React, { useState } from 'react';
import { ChevronRight, RotateCcw } from 'lucide-react';

const QUIZ_STEPS = [
  {
    id: 'goal',
    title: 'What\'s your primary health goal?',
    subtitle: 'Help us recommend the best products for you',
    options: [
      {
        value: 'beauty',
        label: 'Skin, Hair & Nails',
        icon: '✨',
        description: 'Glow, strength & elasticity',
      },
      {
        value: 'joints',
        label: 'Joints & Mobility',
        icon: '💪',
        description: 'Comfort & flexibility',
      },
      {
        value: 'overall',
        label: 'Overall Health',
        icon: '❤️',
        description: 'General wellness & vitality',
      },
      {
        value: 'recovery',
        label: 'Active Recovery',
        icon: '🏃',
        description: 'Post-workout support',
      },
    ],
  },
  {
    id: 'timeframe',
    title: 'When do you want to see results?',
    subtitle: 'Collagen works best with consistency',
    options: [
      {
        value: '4-8weeks',
        label: '4-8 weeks',
        icon: '⚡',
        description: 'Fast-track results',
      },
      {
        value: '8-12weeks',
        label: '8-12 weeks',
        icon: '📅',
        description: 'Standard timeline (recommended)',
      },
      {
        value: '12+weeks',
        label: '12+ weeks',
        icon: '🌱',
        description: 'Long-term commitment',
      },
    ],
  },
  {
    id: 'lifestyle',
    title: 'What\'s your lifestyle like?',
    subtitle: 'This helps us match the right product format',
    options: [
      {
        value: 'active',
        label: 'Very Active',
        icon: '🏋️',
        description: 'Regular exercise & training',
      },
      {
        value: 'moderate',
        label: 'Moderately Active',
        icon: '🚴',
        description: 'Some movement & exercise',
      },
      {
        value: 'sedentary',
        label: 'Mostly Sedentary',
        icon: '🪑',
        description: 'Limited physical activity',
      },
    ],
  },
  {
    id: 'preferences',
    title: 'Any dietary preferences?',
    subtitle: 'We\'ll find products that match your needs',
    options: [
      {
        value: 'vegan',
        label: 'Vegan',
        icon: '🌱',
        description: 'Plant-based only',
      },
      {
        value: 'gluten-free',
        label: 'Gluten-Free',
        icon: '🌾',
        description: 'No gluten',
      },
      {
        value: 'none',
        label: 'No Restrictions',
        icon: '✅',
        description: 'Open to all products',
      },
    ],
  },
];

// Product recommendations based on quiz answers
const PRODUCT_RECOMMENDATIONS = {
  'beauty-8-12weeks-active-none': {
    sku: 'COMBO-COLLAGEN-60',
    name: 'Combo Collagen®',
    match: '95%',
    reason: 'Perfect for active beauty seekers on standard timeline',
  },
  'beauty-8-12weeks-active-vegan': {
    sku: 'COMBO-COLLAGEN-60',
    name: 'Combo Collagen® (Vegan-Friendly)',
    match: '92%',
    reason: 'Best vegan option for beauty & activity',
  },
  'joints-8-12weeks-active-none': {
    sku: 'BJC-BONE-JOINT-60',
    name: 'BJC® Bone & Joint Care',
    match: '98%',
    reason: 'Specifically designed for active joint support',
  },
  'overall-8-12weeks-moderate-none': {
    sku: 'OVOSHELL-COLLAGEN-60',
    name: 'OvoShell Collagen™',
    match: '88%',
    reason: 'Comprehensive wellness formula for all-around health',
  },
  'recovery-8-12weeks-active-none': {
    sku: 'BJC-BONE-JOINT-60',
    name: 'BJC® Bone & Joint Care',
    match: '96%',
    reason: 'Ideal for post-workout recovery and muscle support',
  },
};

export default function QuizComponent({ onComplete = () => {}, variant = 'modal' }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [recommendation, setRecommendation] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);

  const step = QUIZ_STEPS[currentStep];
  const isLastStep = currentStep === QUIZ_STEPS.length - 1;

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
        PRODUCT_RECOMMENDATIONS[key] ||
        PRODUCT_RECOMMENDATIONS[`${newAnswers.goal}-8-12weeks-active-none`] ||
        {
          sku: 'COMBO-COLLAGEN-60',
          name: 'Combo Collagen®',
          match: '85%',
          reason: 'Great all-around collagen supplement',
        };

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

  if (isCompleted) {
    return (
      <div className="rounded-3xl border-2 border-brand-purple bg-gradient-to-b from-brand-purple/10 to-transparent p-8 text-center">
        {/* Success Icon */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-success text-4xl">
            ✓
          </div>
        </div>

        {/* Recommendation */}
        <h2 className="mb-2 text-2xl font-black text-brand-navy">Perfect Match Found!</h2>
        <p className="mb-6 text-sm text-brand-muted">
          Based on your answers, we found the ideal product for you
        </p>

        {/* Product Card */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-4 text-center">
            <span className="inline-block rounded-full bg-brand-purple/10 px-4 py-2 text-xs font-bold text-brand-purple">
              {recommendation.match} Match
            </span>
          </div>

          <h3 className="mb-2 text-xl font-bold text-brand-navy">{recommendation.name}</h3>
          <p className="mb-4 text-sm text-brand-muted">{recommendation.reason}</p>

          <button
            onClick={handleAddToCart}
            className="w-full rounded-lg bg-brand-purple py-3 font-bold uppercase text-white hover:bg-brand-purple/90 transition-colors mb-2"
          >
            Add to Cart
          </button>
          <button
            onClick={handleReset}
            className="w-full rounded-lg border border-slate-200 bg-white py-3 font-bold uppercase text-brand-navy hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Start Over
          </button>
        </div>

        {/* Your Answers Summary */}
        <div className="rounded-lg bg-slate-50 p-4 text-left">
          <p className="mb-3 text-xs font-bold uppercase text-brand-muted">Your Preferences</p>
          <div className="space-y-2 text-xs">
            {Object.entries(answers).map(([key, value]) => {
              const stepData = QUIZ_STEPS.find((s) => s.id === key);
              const option = stepData?.options.find((o) => o.value === value);
              return (
                <div key={key} className="flex justify-between">
                  <span className="text-brand-muted">{stepData?.title}:</span>
                  <span className="font-bold text-brand-navy">{option?.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="mb-2 flex justify-between text-xs font-bold text-brand-muted">
          <span>Question {currentStep + 1}</span>
          <span>{currentStep + 1} of {QUIZ_STEPS.length}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-brand-purple transition-all duration-300"
            style={{ width: `${((currentStep + 1) / QUIZ_STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <h2 className="mb-2 text-2xl font-black text-brand-navy">{step.title}</h2>
      <p className="mb-6 text-sm text-brand-muted">{step.subtitle}</p>

      {/* Options */}
      <div className="mb-8 space-y-3">
        {step.options.map((option) => (
          <button
            key={option.value}
            onClick={() => handleSelectOption(option.value)}
            className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
              answers[step.id] === option.value
                ? 'border-brand-purple bg-brand-purple/10'
                : 'border-slate-200 bg-white hover:border-brand-purple/50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-bold text-brand-navy">{option.label}</div>
                <div className="text-xs text-brand-muted">{option.description}</div>
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
          className="flex-1 rounded-lg border border-slate-200 bg-white py-3 font-bold uppercase text-brand-navy hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <button
          onClick={() => handleSelectOption(answers[step.id])}
          disabled={!answers[step.id]}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-brand-purple py-3 font-bold uppercase text-white hover:bg-brand-purple/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLastStep ? 'Get Recommendation' : 'Next'}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
