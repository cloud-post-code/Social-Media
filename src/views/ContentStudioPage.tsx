import React from 'react';
import AssetGenerator from '../components/AssetGenerator.js';
import { BrandDNA, GeneratedAsset } from '../models/types.js';

interface ContentStudioPageProps {
  activeBrand: BrandDNA | null;
  onAssetCreated: (asset: GeneratedAsset) => void;
}

const ContentStudioPage: React.FC<ContentStudioPageProps> = ({ activeBrand, onAssetCreated }) => {
  return (
    <AssetGenerator 
      activeBrand={activeBrand}
      onAssetCreated={onAssetCreated}
    />
  );
};

export default ContentStudioPage;

