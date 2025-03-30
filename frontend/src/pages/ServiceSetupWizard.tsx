import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FlowStep, ServiceDefinition } from '../types/ServiceDefinition';

// This is a placeholder. In the real app, we'd load from plugins
const mockServiceDetails: Record<string, ServiceDefinition> = {
  'openai': {
    id: 'openai',
    name: 'OpenAI API Key',
    description: 'Set up API keys for OpenAI services like GPT-4 and DALL-E',
    icon: '🧠',
    type: 'apiKey',
    setupSteps: [
      { 
        type: 'link', 
        label: 'Open OpenAI API Keys Page', 
        url: 'https://platform.openai.com/account/api-keys',
        description: 'Log in to your OpenAI account and navigate to the API Keys section of the user settings.' 
      },
      { 
        type: 'instruction', 
        text: 'Click on **Create new secret key** to generate a new API key.' 
      },
      { 
        type: 'input', 
        label: 'OpenAI Secret Key', 
        id: 'openai_api_key',
        hint: 'Copy the newly generated key from the OpenAI page and paste it here.' 
      },
      { 
        type: 'verify', 
        action: 'verifyOpenAIKey'
      }
    ]
  },
  'google': {
    id: 'google',
    name: 'Google Cloud OAuth',
    description: 'Configure OAuth credentials for Google services',
    icon: '🔍',
    type: 'oauth',
    setupSteps: [
      {
        type: 'instruction',
        text: 'We will obtain OAuth 2.0 credentials for Google. You\'ll be asked to log in to your Google Account and grant access.'
      },
      {
        type: 'link',
        label: 'Start Google OAuth',
        action: 'startGoogleOAuth',
        description: 'Click to begin the Google OAuth authentication process.'
      }
    ]
  },
  'signal': {
    id: 'signal',
    name: 'Signal API Setup',
    description: 'Set up Signal messaging integration via CallMeBot',
    icon: '📱',
    type: 'apiKey',
    setupSteps: [
      {
        type: 'instruction',
        text: 'Signal does not have an official API. However, we can use a trusted third-party service (CallMeBot) to send messages to your Signal account.'
      },
      {
        type: 'instruction',
        text: '1. Add a new contact in Signal with the number **+34 603 21 25 97** (this is the CallMeBot Signal number). Name it "Signal Bot".\n\n2. Send a message to this contact exactly saying: `I allow callmebot to send me messages`.\n\n3. Within a few seconds, you will receive a reply from the bot with your personal API key.'
      },
      {
        type: 'input',
        label: 'Signal API Key',
        id: 'signal_api_key',
        hint: 'Enter the API key you received from the Signal bot.'
      },
      {
        type: 'input',
        label: 'Your Phone Number',
        id: 'signal_phone',
        hint: 'Enter your phone number with country code (e.g., +1234567890).'
      },
      {
        type: 'verify',
        action: 'verifySignalKey'
      }
    ]
  }
};

const ServiceSetupWizard: React.FC = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  
  const [service, setService] = useState<ServiceDefinition | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    // In a real app, we'd load the service definition from the backend
    if (serviceId && mockServiceDetails[serviceId]) {
      setService(mockServiceDetails[serviceId]);
    } else {
      // Service not found
      navigate('/');
    }
  }, [serviceId, navigate]);

  if (!service) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const steps = service.setupSteps || [];
  const currentStepData = steps[currentStep];
  
  const handleInputChange = (id: string, value: string) => {
    setInputValues(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleNext = async () => {
    // If this is a verification step, perform the verification
    if (currentStepData.type === 'verify') {
      setIsVerifying(true);
      try {
        // In a real app, we'd call the backend to verify
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Simulate successful verification
        setVerificationResult({
          success: true,
          message: 'Verification successful!'
        });
        
        // Move to the next step or finish if this is the last step
        if (currentStep < steps.length - 1) {
          setTimeout(() => {
            setCurrentStep(currentStep + 1);
            setIsVerifying(false);
            setVerificationResult(null);
          }, 1000);
        } else {
          // Completion logic would go here
          setTimeout(() => {
            navigate('/');
          }, 2000);
        }
      } catch (error) {
        setVerificationResult({
          success: false,
          message: 'Verification failed. Please check your input and try again.'
        });
        setIsVerifying(false);
      }
    } else if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // If we're at the last step and it's not a verification step
      navigate('/');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setVerificationResult(null);
    } else {
      navigate('/');
    }
  };

  const handleExternalLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Render different UI based on step type
  const renderStepContent = () => {
    switch (currentStepData.type) {
      case 'link':
        return (
          <div className="text-center">
            <p className="mb-4">{currentStepData.description}</p>
            <button
              onClick={() => handleExternalLink(currentStepData.url!)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg"
            >
              {currentStepData.label}
            </button>
          </div>
        );
      
      case 'instruction':
        return (
          <div className="prose prose-blue max-w-none">
            <div dangerouslySetInnerHTML={{ __html: currentStepData.text!.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n\n/g, '<br/><br/>') }} />
          </div>
        );
      
      case 'input':
        return (
          <div>
            {currentStepData.description && <p className="mb-4">{currentStepData.description}</p>}
            <label className="block text-sm font-medium text-gray-700 mb-1">{currentStepData.label}</label>
            <input
              type="text"
              id={currentStepData.id}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder={currentStepData.hint}
              value={inputValues[currentStepData.id!] || ''}
              onChange={(e) => handleInputChange(currentStepData.id!, e.target.value)}
            />
            {currentStepData.hint && <p className="mt-1 text-sm text-gray-500">{currentStepData.hint}</p>}
          </div>
        );
      
      case 'verify':
        return (
          <div className="text-center">
            {isVerifying ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                <p>Verifying your credentials...</p>
              </div>
            ) : verificationResult ? (
              <div className={`p-4 rounded-md ${verificationResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                <p>{verificationResult.message}</p>
              </div>
            ) : (
              <div>
                <p className="mb-4">Click the button below to verify your credentials.</p>
                <button
                  onClick={handleNext}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg"
                >
                  Verify Credentials
                </button>
              </div>
            )}
          </div>
        );
      
      default:
        return <p>Unknown step type</p>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <button 
          onClick={handleBack} 
          className="text-blue-500 hover:text-blue-600 flex items-center"
        >
          ← Back
        </button>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <header className="mb-8">
          <div className="flex items-center mb-4">
            <span className="text-3xl mr-3">{service.icon}</span>
            <h1 className="text-2xl font-bold">{service.name}</h1>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-500 h-2.5 rounded-full" 
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            ></div>
          </div>
          <p className="mt-2 text-gray-500 text-sm">Step {currentStep + 1} of {steps.length}</p>
        </header>

        <div className="mb-8">
          {renderStepContent()}
        </div>

        <div className="flex justify-between">
          <button
            onClick={handleBack}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50"
          >
            Back
          </button>
          
          {currentStepData.type !== 'verify' && (
            <button
              onClick={handleNext}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
            >
              {currentStep < steps.length - 1 ? 'Next' : 'Finish'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceSetupWizard; 