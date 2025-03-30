import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ServiceDefinition } from '../types/ServiceDefinition';

const HomePage: React.FC = () => {
  const [services, setServices] = useState<ServiceDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // In a production app, this would load from the plugins directory
    // For now, we'll use some hardcoded examples
    const loadServices = async () => {
      // Simulating a load delay
      await new Promise(resolve => setTimeout(resolve, 500));

      setServices([
        {
          id: 'openai',
          name: 'OpenAI API Key',
          description: 'Set up API keys for OpenAI services like GPT-4 and DALL-E',
          icon: '🧠',
          type: 'apiKey'
        },
        {
          id: 'google',
          name: 'Google Cloud OAuth',
          description: 'Configure OAuth credentials for Google services',
          icon: '🔍',
          type: 'oauth'
        },
        {
          id: 'signal',
          name: 'Signal API Setup',
          description: 'Set up Signal messaging integration via CallMeBot',
          icon: '📱',
          type: 'apiKey'
        },
        {
          id: 'slack',
          name: 'Slack Bot Token',
          description: 'Create and configure a Slack Bot for your workspace',
          icon: '💬',
          type: 'oauth'
        },
      ]);
      setIsLoading(false);
    };

    loadServices();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">API Credential Manager</h1>
        <p className="text-gray-600">
          Securely set up and manage API keys and OAuth tokens for your AI agents
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map(service => (
            <Link
              key={service.id}
              to={`/setup/${service.id}`}
              className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start">
                <div className="text-2xl mr-4">{service.icon}</div>
                <div>
                  <h2 className="text-xl font-semibold mb-2">{service.name}</h2>
                  <p className="text-gray-600 mb-4">{service.description}</p>
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    {service.type === 'oauth' ? 'OAuth 2.0' : 'API Key'}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default HomePage; 