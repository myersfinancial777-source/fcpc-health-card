export const NAVY = '#0B2545';
export const TEAL = '#1B8A8C';
export const TEAL_LIGHT = '#E0F5F5';
export const TEAL_MED = '#A8DCD9';
export const DARK_GRAY = '#333333';
export const MED_GRAY = '#666666';
export const LIGHT_GRAY = '#F0F4F5';
export const BORDER_GRAY = '#D0D8DA';

export const STATUS_OPTIONS = [
  { key: 'good', label: 'Good', color: '#22C55E', icon: '✓' },
  { key: 'fair', label: 'Fair', color: '#F59E0B', icon: '~' },
  { key: 'attention', label: 'Attention', color: '#EF4444', icon: '!' },
  { key: 'na', label: 'N/A', color: '#9CA3AF', icon: '—' },
];

export const SECTIONS = [
  { title: 'HVAC System', icon: '❄️', items: ['Thermostat operation & settings', 'Air filter condition / replacement', 'AC drain line — flush & inspect', 'Supply & return vents — airflow', 'Condensate pan & line', 'Unusual noises or odors'] },
  { title: 'Plumbing', icon: '🔧', items: ['Faucets — drips, pressure, hot/cold', 'Toilets — flush, fill, base seal', 'Under-sink inspection (leaks, corrosion)', 'Water heater — temp, visible leaks', 'Garbage disposal operation', 'Hose bibs & exterior spigots'] },
  { title: 'Electrical & Safety', icon: '⚡', items: ['Outlets & switches — function test', 'GFCI outlets — test & reset', 'Light fixtures & bulbs', 'Smoke / CO detectors — test & battery', 'Breaker panel — visual inspection'] },
  { title: 'Interior Condition', icon: '🏠', items: ['Doors & locks — alignment, operation', 'Windows — seals, locks, screens', 'Walls & ceilings — stains, cracks', 'Flooring — damage, loose tiles, hazards', 'Appliances — operation check', 'Cabinets & drawers — hardware'] },
  { title: 'Exterior & Grounds', icon: '🌿', items: ['Roof visible condition (from ground)', 'Gutters & downspouts', 'Siding, paint, trim condition', 'Walkways, driveway, patio', 'Landscaping & irrigation', 'Pool / hot tub (if applicable)'] },
];

export const PLAN_TIERS = ['Basic', 'Standard', 'Premium'];
export const OVERALL_RATINGS = ['Excellent', 'Good', 'Fair', 'Needs Attention'];
