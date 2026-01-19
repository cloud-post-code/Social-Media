import React from 'react';
import BrandDNAForm from '../components/BrandDNAForm.js';
import { BrandDNA } from '../models/types.js';

interface BrandDNAPageProps {
  activeBrand: BrandDNA | null;
  onSave: (dna: BrandDNA) => void;
  onCancel: () => void;
  onViewAssets?: () => void;
}

const BrandDNAPage: React.FC<BrandDNAPageProps> = ({ activeBrand, onSave, onCancel, onViewAssets }) => {
  return (
    <BrandDNAForm 
      dna={activeBrand || {}}
      onSave={onSave}
      onCancel={onCancel}
      onViewAssets={onViewAssets}
    />
  );
};

export default BrandDNAPage;

