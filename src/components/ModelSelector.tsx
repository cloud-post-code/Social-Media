import React from 'react';
import { ImageModel, IMAGE_MODELS } from '../models/types';

interface ModelSelectorProps {
  selectedModel: ImageModel | undefined;
  onModelChange: (model: ImageModel | undefined) => void;
  disabled?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  disabled = false,
}) => {
  // Load saved model from localStorage on mount
  React.useEffect(() => {
    const savedModel = localStorage.getItem('selectedImageModel') as ImageModel | null;
    if (savedModel && IMAGE_MODELS.some(m => m.id === savedModel)) {
      onModelChange(savedModel);
    }
  }, []);

  const handleModelChange = (modelId: string) => {
    if (modelId === '') {
      onModelChange(undefined);
      localStorage.removeItem('selectedImageModel');
    } else {
      const model = modelId as ImageModel;
      onModelChange(model);
      localStorage.setItem('selectedImageModel', model);
    }
  };

  return (
    <div className="space-y-2">
      <select
        value={selectedModel || ''}
        onChange={(e) => handleModelChange(e.target.value)}
        disabled={disabled}
        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none 
                   focus:bg-white focus:ring-2 focus:ring-indigo-50/50 focus:border-indigo-500 
                   transition-all text-sm font-bold text-slate-700
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">Default (Gemini)</option>
        {IMAGE_MODELS.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-slate-500 ml-4">
        {selectedModel 
          ? IMAGE_MODELS.find(m => m.id === selectedModel)?.description 
          : 'Using Google Gemini for image generation (default)'
        }
      </p>
    </div>
  );
};

export default ModelSelector;
