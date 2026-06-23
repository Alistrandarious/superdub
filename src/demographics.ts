// Shared option lists for the demographic / job / religion fields captured at
// signup and editable on Profile. Kept in one place so both stay in sync.
// All fields are optional; every list includes a "Prefer not to say" escape.

export const PREFER_NOT = 'Prefer not to say';

// Common occupations — a flat, scannable job list (not exhaustive; "Other" covers the rest).
export const OCCUPATIONS = [
  'Healthcare / Medical',
  'Nursing / Care',
  'Education / Teaching',
  'Software / IT',
  'Engineering',
  'Science / Research',
  'Finance / Accounting',
  'Law / Legal',
  'Sales',
  'Marketing / PR',
  'Management / Executive',
  'Administration / Office',
  'Customer Service',
  'Retail',
  'Hospitality / Food service',
  'Construction / Trades',
  'Manufacturing',
  'Transport / Logistics',
  'Agriculture',
  'Arts / Design',
  'Media / Entertainment',
  'Sports / Fitness',
  'Public sector / Government',
  'Military / Emergency services',
  'Social work / Charity',
  'Self-employed / Business owner',
  'Student',
  'Homemaker',
  'Unemployed',
  'Retired',
  'Other',
  PREFER_NOT,
];

export const ETHNICITIES = [
  'White',
  'Black / African / Caribbean',
  'South Asian',
  'East Asian',
  'Southeast Asian',
  'Middle Eastern / North African',
  'Hispanic / Latino',
  'Mixed / Multiple',
  'Other',
  PREFER_NOT,
];

export const GENDER_IDENTITIES = [
  'Man',
  'Woman',
  'Non-binary',
  'Transgender man',
  'Transgender woman',
  'Other',
  PREFER_NOT,
];

export const RELATIONSHIP_STATUSES = [
  'Single',
  'In a relationship',
  'Married / Civil partnership',
  'Cohabiting',
  'Separated / Divorced',
  'Widowed',
  PREFER_NOT,
];

export const RELIGIONS = [
  'None / Non-religious',
  'Christianity',
  'Islam',
  'Hinduism',
  'Buddhism',
  'Sikhism',
  'Judaism',
  'Spiritual (no specific religion)',
  'Other',
  PREFER_NOT,
];

// Comprehensive country list (common-name form).
export const COUNTRIES = [
  'United Kingdom', 'United States', 'Canada', 'Australia', 'Ireland', 'New Zealand',
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Argentina', 'Armenia', 'Austria',
  'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize',
  'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei',
  'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Cape Verde',
  'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo',
  'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czechia', 'Denmark', 'Djibouti', 'Dominica',
  'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Estonia', 'Eswatini', 'Ethiopia',
  'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece',
  'Grenada', 'Guatemala', 'Guinea', 'Guyana', 'Haiti', 'Honduras', 'Hungary', 'Iceland',
  'India', 'Indonesia', 'Iran', 'Iraq', 'Israel', 'Italy', 'Ivory Coast', 'Jamaica', 'Japan',
  'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon',
  'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar',
  'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Mauritania', 'Mauritius', 'Mexico',
  'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia',
  'Nepal', 'Netherlands', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia',
  'Norway', 'Oman', 'Pakistan', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru',
  'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saudi Arabia',
  'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia',
  'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan',
  'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand',
  'Togo', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Uganda', 'Ukraine',
  'United Arab Emirates', 'Uruguay', 'Uzbekistan', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia',
  'Zimbabwe', 'Other', PREFER_NOT,
];
