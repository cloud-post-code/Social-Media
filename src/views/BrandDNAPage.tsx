import React from 'react';
import BrandDNAForm from '../components/BrandDNAForm.js';
import { BrandDNA } from '../models/types.js';

interface BrandDNAPageProps {
  activeBrand: BrandDNA | null;
  onSave: (dna: BrandDNA) => Promise<BrandDNA>;
  onCancel: () => void;
}

const BrandDNAPage: React.FC<BrandDNAPageProps> = ({ activeBrand, onSave, onCancel }) => {
  return (
    <BrandDNAForm 
      dna={activeBrand || {}}
      onSave={onSave}
      onCancel={onCancel}
    />
  );
};

export default BrandDNAPage;

