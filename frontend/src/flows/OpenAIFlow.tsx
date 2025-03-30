import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { credentialVault } from '../utils/credentialVault';

// This is a placeholder for an actual API verification function
// In a real app, this would call the backend which would make the API request
const verifyOpenAIKey = async (apiKey: string): Promise<{ valid: boolean; error?: string }> => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Check if the key starts with "sk-" (simple validation for demo)
  if (!apiKey.startsWith('sk-')) {
    return { valid: false, error: 'Invalid API key format. OpenAI keys typically start with "sk-".' };
  }
  
  // In a real app, we'd make an actual API call to verify the key
  return { valid: true };
};

interface OpenAIFlowProps {
  onComplete: () => void;
}

const OpenAIFlow: React.FC<OpenAIFlowProps> = ({ onComplete }) => {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsVerifying(true);
    
    try {
      const result = await verifyOpenAIKey(apiKey);
      
      if (result.valid) {
        // Save the credential to the vault
        const saved = await credentialVault.saveCredential({
          id: 'openai_api_key',
          serviceId: 'openai',
          name: 'OpenAI API Key',
          value: apiKey,
          type: 'apiKey',
          lastVerified: Date.now()
        });
        
        if (saved) {
          setSuccess(true);
          setTimeout(() => {
            onComplete();
          }, 1500);
        } else {
          setError('Failed to save the API key. Please try again.');
        }
      } else {
        setError(result.error || 'Invalid API key. Please check and try again.');
      }
    } catch (error) {
      setError('An error occurred while verifying the API key.');
      console.error('Verification error:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  const openOpenAIKeyPage = () => {
    window.open('https://platform.openai.com/account/api-keys', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">OpenAI API Key Setup</h2>
      
      <div className="mb-6">
        <p className="mb-4">
          To use OpenAI services, you need to provide your API key. Follow these steps:
        </p>
        
        <ol className="list-decimal pl-5 space-y-2 mb-4">
          <li>Log in to your OpenAI account</li>
          <li>Go to the API keys section in your account settings</li>
          <li>Click on "Create new secret key"</li>
          <li>Copy the key and paste it below</li>
        </ol>
        
        <button
          onClick={openOpenAIKeyPage}
          className="text-blue-500 hover:text-blue-700 font-medium"
        >
          Open OpenAI API Keys Page →
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
            OpenAI API Key
          </label>
          <input
            type="text"
            id="apiKey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="sk-..."
            required
          />
          <p className="mt-1 text-sm text-gray-500">
            Your API key is sensitive information. It will be stored securely on your device.
          </p>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md">
            API key saved successfully!
          </div>
        )}
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isVerifying || success}
            className={`px-4 py-2 rounded-md text-white ${
              isVerifying || success
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {isVerifying ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Verifying...
              </span>
            ) : success ? (
              'Verified'
            ) : (
              'Verify and Save'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default OpenAIFlow; 