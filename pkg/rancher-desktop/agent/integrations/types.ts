export interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  paid: boolean;
  sort: number;
  beta: boolean;
  comingSoon: boolean;
  connected: boolean;
  version: string;
  lastUpdated: string;
  developer: string;
  formGuide?: string;
  installationGuide?: {
    title: string;
    description: string;
    steps: Array<{
      title: string;
      content: string;
    }>;
    importantNotes?: string[];
  };
  media?: Array<{
    type: 'youtube' | 'image';
    url: string;
    alt: string;
    caption?: string;
  }>;
  features?: Array<{
    title: string;
    description: string;
  }>;
  guideLinks?: Array<{
    title: string;
    description: string;
    url: string;
  }>;
  properties?: Array<{
    key: string;
    title: string;
    hint: string;
    type: 'text' | 'password' | 'url' | 'select';
    required: boolean;
    placeholder: string;
    /** For type 'select': the ID of the SelectBoxProvider that resolves options */
    selectBoxId?: string;
    /** For type 'select': keys of sibling properties whose current values are sent to the provider */
    selectDependsOn?: string[];
    validation?: {
      pattern?: string;
      minLength?: number;
      maxLength?: number;
    };
  }>;
}
