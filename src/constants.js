export const NAVY = '#0B2545';
export const TEAL = '#1B8A8C';
export const TEAL_LIGHT = '#E0F5F5';
export const TEAL_MED = '#A8DCD9';
export const DARK_GRAY = '#333333';
export const MED_GRAY = '#666666';
export const LIGHT_GRAY = '#F0F4F5';
export const BORDER_GRAY = '#D0D8DA';

export const STATUS_OPTIONS = [
  { key: 'good', label: 'Good', color: '#22C55E', icon: '\u2713' },
  { key: 'fair', label: 'Fair', color: '#F59E0B', icon: '~' },
  { key: 'attention', label: 'Attention', color: '#EF4444', icon: '!' },
  { key: 'na', label: 'N/A', color: '#9CA3AF', icon: '\u2014' },
];

export const SECTIONS = [
  { title: 'HVAC System', icon: '\u2744\uFE0F', items: ['Thermostat operation & settings', 'Air filter condition / replacement', 'AC drain line \u2014 flush & inspect', 'Supply & return vents \u2014 airflow', 'Unusual noises or odors'] },
  { title: 'Plumbing', icon: '\u{1F527}', items: ['Faucets \u2014 drips, pressure, hot/cold', 'Toilets \u2014 flush, fill, base seal', 'Under-sink inspection (leaks, corrosion)', 'Water heater \u2014 temp, visible leaks', 'Garbage disposal operation', 'Hose bibs & exterior spigots'] },
  { title: 'Electrical & Safety', icon: '\u26A1', items: ['Outlets & switches \u2014 function test', 'GFCI outlets \u2014 test & reset', 'Light fixtures & bulbs', 'Smoke / CO detectors \u2014 test & battery', 'Breaker panel \u2014 visual inspection'] },
  { title: 'Interior Condition', icon: '\u{1F3E0}', items: ['Doors & locks \u2014 alignment, operation', 'Windows \u2014 seals, locks, screens', 'Walls & ceilings \u2014 stains, cracks', 'Flooring \u2014 damage, loose tiles, hazards', 'Furniture condition check', 'Appliances \u2014 operation check', 'Dishwasher filter check & cleaning', 'Cabinets & drawers \u2014 hardware'] },
  { title: 'Exterior & Grounds', icon: '\u{1F33F}', items: ['Roof visible condition (from ground)', 'Gutters & downspouts', 'Siding, paint, trim condition', 'Walkways, driveway, patio', 'Landscaping & irrigation', 'Pool / hot tub (if applicable)'] },
];

export const PLAN_TIERS = ['Basic', 'Standard', 'Premium'];
export const OVERALL_RATINGS = ['Excellent', 'Good', 'Fair', 'Needs Attention'];