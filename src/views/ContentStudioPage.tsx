import React from 'react';
import AssetGenerator from '../components/AssetGenerator.js';
import { BrandDNA, GeneratedAsset } from '../models/types.js';

interface ContentStudioPageProps {
  activeBrand: BrandDNA | null;
  onAssetCreated: (asset: GeneratedAsset) => void;
  initialAsset?: GeneratedAsset | null;
}

const ContentStudioPage: React.FC<ContentStudioPageProps> = ({ activeBrand, onAssetCreated, initialAsset }) => {
  return (
    <AssetGenerator 
      activeBrand={activeBrand}
      onAssetCreated={onAssetCreated}
      initialAsset={initialAsset}
    />
  );
};

export default ContentStudioPage;

