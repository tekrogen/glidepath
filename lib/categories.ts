// Standardized category system based on Monthly_Financial_Tracker_2025.py

export interface CategoryDefinition {
  name: string;
  type: 'INCOME' | 'EXPENSE';
  keywords: string[];
  subcategories?: CategoryDefinition[];
}

export const STANDARD_CATEGORIES: CategoryDefinition[] = [
  // INCOME CATEGORIES
  {
    name: 'Salary/Wages',
    type: 'INCOME',
    keywords: ['salary', 'wages', 'payroll', 'paycheck', 'direct deposit', 'employer']
  },
  {
    name: 'Business Income',
    type: 'INCOME',
    keywords: ['business', 'freelance', 'consulting', 'contract', 'invoice', 'client payment', 'remote online deposit']
  },
  {
    name: 'Government Payments',
    type: 'INCOME',
    keywords: ['sba', 'treasury', 'government', 'stimulus', 'tax refund', 'unemployment']
  },
  {
    name: 'Social Security',
    type: 'INCOME',
    keywords: ['ssa', 'social security', 'ssdi', 'disability']
  },
  {
    name: 'Pension/Retirement',
    type: 'INCOME',
    keywords: ['pension', 'retirement', '401k', 'ira', 'banner retirement']
  },
  {
    name: 'Investment Income',
    type: 'INCOME',
    keywords: ['dividend', 'interest paid', 'investment', 'capital gains', 'stock']
  },
  {
    name: 'Rental Income',
    type: 'INCOME',
    keywords: ['rent', 'rental', 'property income']
  },
  {
    name: 'Transfers In',
    type: 'INCOME',
    keywords: ['transfer from', 'internet transfer from', 'funds transfer cr', 'transfer in']
  },
  {
    name: 'Zelle Received',
    type: 'INCOME',
    keywords: ['zelle from', 'zelle received', 'zelle deposit']
  },
  {
    name: 'Refunds/Credits',
    type: 'INCOME',
    keywords: ['refund', 'credit return', 'cashback', 'rebate', 'return']
  },
  {
    name: 'Other Income',
    type: 'INCOME',
    keywords: ['deposit', 'income', 'payment received']
  },

  // EXPENSE CATEGORIES
  {
    name: 'Housing',
    type: 'EXPENSE',
    keywords: ['mortgage', 'rent', 'dovenmuehle', 'del tura', 'country lakes'],
    subcategories: [
      {
        name: 'Mortgage/Rent',
        type: 'EXPENSE',
        keywords: ['mortgage', 'rent', 'dovenmuehle']
      },
      {
        name: 'Property Tax',
        type: 'EXPENSE',
        keywords: ['property tax', 'tax assessment']
      },
      {
        name: 'HOA Fees',
        type: 'EXPENSE',
        keywords: ['hoa', 'homeowners association', 'timber ridge']
      },
      {
        name: 'Home Insurance',
        type: 'EXPENSE',
        keywords: ['home insurance', 'homeowners insurance']
      },
      {
        name: 'Home Maintenance',
        type: 'EXPENSE',
        keywords: ['home depot', 'lowes', 'repair', 'maintenance']
      }
    ]
  },
  {
    name: 'Utilities',
    type: 'EXPENSE',
    keywords: ['electric', 'gas', 'water', 'sewer', 'internet', 'cable', 'phone', 'comed', 'fpl', 'lee county utilities', 'lake barrington water'],
    subcategories: [
      {
        name: 'Electric',
        type: 'EXPENSE',
        keywords: ['electric', 'comed', 'fpl', 'power company']
      },
      {
        name: 'Gas',
        type: 'EXPENSE',
        keywords: ['gas company', 'natural gas']
      },
      {
        name: 'Water/Sewer',
        type: 'EXPENSE',
        keywords: ['water', 'sewer', 'lake barrington water', 'lee county utilities']
      },
      {
        name: 'Internet/Cable',
        type: 'EXPENSE',
        keywords: ['internet', 'cable', 'comcast', 'verizon', 'att']
      },
      {
        name: 'Phone',
        type: 'EXPENSE',
        keywords: ['phone', 'mobile', 'cellular', 'verizon', 'att', 't-mobile']
      }
    ]
  },
  {
    name: 'Transportation',
    type: 'EXPENSE',
    keywords: ['gas', 'fuel', 'auto', 'car', 'vehicle', 'insurance', 'shell'],
    subcategories: [
      {
        name: 'Car Payment',
        type: 'EXPENSE',
        keywords: ['car payment', 'auto loan', 'vehicle loan']
      },
      {
        name: 'Auto Insurance',
        type: 'EXPENSE',
        keywords: ['auto insurance', 'car insurance', 'usaa p&c', 'geico', 'state farm']
      },
      {
        name: 'Gas/Fuel',
        type: 'EXPENSE',
        keywords: ['shell', 'exxon', 'bp', 'chevron', 'gas station', 'fuel']
      },
      {
        name: 'Auto Maintenance',
        type: 'EXPENSE',
        keywords: ['auto repair', 'oil change', 'tire', 'brake', 'maintenance']
      },
      {
        name: 'Parking/Tolls',
        type: 'EXPENSE',
        keywords: ['parking', 'toll', 'meter']
      }
    ]
  },
  {
    name: 'Travel',
    type: 'EXPENSE',
    keywords: ['travel', 'airline', 'flight', 'hotel', 'airbnb', 'vrbo', 'resort', 'cruise'],
    subcategories: [
      {
        name: 'Flights',
        type: 'EXPENSE',
        keywords: ['airline', 'flight', 'united', 'delta', 'american air', 'southwest', 'jetblue', 'alaska air']
      },
      {
        name: 'Lodging',
        type: 'EXPENSE',
        keywords: ['hotel', 'airbnb', 'vrbo', 'marriott', 'hilton', 'hyatt', 'resort']
      }
    ]
  },
  {
    name: 'Food & Dining',
    type: 'EXPENSE',
    keywords: ['restaurant', 'food', 'dining', 'grocery', 'starbucks', 'hungry mule'],
    subcategories: [
      {
        name: 'Groceries',
        type: 'EXPENSE',
        keywords: ['grocery', 'supermarket', 'whole foods', 'kroger', 'walmart', 'target']
      },
      {
        name: 'Restaurants',
        type: 'EXPENSE',
        keywords: ['restaurant', 'dining', 'hungry mule', 'mcdonalds', 'burger king']
      },
      {
        name: 'Coffee/Snacks',
        type: 'EXPENSE',
        keywords: ['starbucks', 'coffee', 'dunkin', 'snack']
      }
    ]
  },
  {
    name: 'Healthcare',
    type: 'EXPENSE',
    keywords: ['health', 'medical', 'dental', 'doctor', 'hospital', 'pharmacy', 'florida blue'],
    subcategories: [
      {
        name: 'Health Insurance',
        type: 'EXPENSE',
        keywords: ['health insurance', 'florida blue', 'bcbs', 'aetna', 'cigna']
      },
      {
        name: 'Medical/Dental',
        type: 'EXPENSE',
        keywords: ['medical', 'dental', 'doctor', 'dentist', 'hospital']
      },
      {
        name: 'Prescriptions',
        type: 'EXPENSE',
        keywords: ['pharmacy', 'prescription', 'cvs', 'walgreens', 'medication']
      }
    ]
  },
  {
    name: 'Personal & Family',
    type: 'EXPENSE',
    keywords: ['clothing', 'personal care', 'gift', 'entertainment'],
    subcategories: [
      {
        name: 'Clothing',
        type: 'EXPENSE',
        keywords: ['clothing', 'apparel', 'shoes', 'fashion']
      },
      {
        name: 'Personal Care',
        type: 'EXPENSE',
        keywords: ['salon', 'barber', 'spa', 'personal care']
      },
      {
        name: 'Gifts',
        type: 'EXPENSE',
        keywords: ['gift', 'present', 'birthday', 'holiday']
      },
      {
        name: 'Entertainment',
        type: 'EXPENSE',
        keywords: ['entertainment', 'movie', 'concert', 'theater', 'netflix', 'hulu', 'spotify', 'disney+', 'max.com', 'youtube premium', 'apple.com/bill', 'icloud']
      }
    ]
  },
  {
    name: 'Business Expenses',
    type: 'EXPENSE',
    keywords: ['business', 'office', 'professional', 'subscription', 'software', 'mailchimp', 'npm', 'jetbrains', 'bitwarden', 'squarespace'],
    subcategories: [
      {
        name: 'Subscriptions/Software',
        type: 'EXPENSE',
        keywords: ['subscription', 'software', 'saas', 'mailchimp', 'npm', 'jetbrains', 'bitwarden', 'squarespace', 'hulu']
      },
      {
        name: 'Professional Services',
        type: 'EXPENSE',
        keywords: ['professional', 'consultant', 'lawyer', 'accountant']
      },
      {
        name: 'Office Supplies',
        type: 'EXPENSE',
        keywords: ['office', 'supplies', 'amazon', 'staples']
      }
    ]
  },
  {
    name: 'Financial',
    type: 'EXPENSE',
    keywords: ['payment', 'transfer', 'fee', 'charge', 'chase card payment', 'sccu payment'],
    subcategories: [
      {
        name: 'Credit Card Payments',
        type: 'EXPENSE',
        keywords: ['credit card payment', 'chase card payment', 'sccu payment', 'card payment']
      },
      {
        name: 'Bank Fees',
        type: 'EXPENSE',
        keywords: ['fee', 'charge', 'overdraft', 'maintenance fee']
      },
      {
        name: 'Transfers Out',
        type: 'EXPENSE',
        keywords: ['transfer to', 'transfer out', 'funds transfer']
      },
      {
        name: 'Zelle Sent',
        type: 'EXPENSE',
        keywords: ['zelle to', 'zelle sent', 'zelle payment']
      }
    ]
  },
  {
    name: 'Other Expenses',
    type: 'EXPENSE',
    keywords: ['other', 'miscellaneous', 'unknown']
  }
];

export function categorizeTransaction(description: string, amount: number): { category: string; subcategory?: string } {
  const desc = description.toLowerCase();
  const isIncome = amount > 0;
  
  // Filter categories by type
  const relevantCategories = STANDARD_CATEGORIES.filter(cat => 
    isIncome ? cat.type === 'INCOME' : cat.type === 'EXPENSE'
  );

  // Find matching category
  for (const category of relevantCategories) {
    // Check main category keywords
    if (category.keywords.some(keyword => desc.includes(keyword.toLowerCase()))) {
      // Check for subcategory match
      if (category.subcategories) {
        for (const subcat of category.subcategories) {
          if (subcat.keywords.some(keyword => desc.includes(keyword.toLowerCase()))) {
            return { category: category.name, subcategory: subcat.name };
          }
        }
      }
      return { category: category.name };
    }
  }

  // Second pass: match subcategory keywords directly. Merchant strings like
  // "NETFLIX.COM" match a subcategory ("Entertainment") without containing any
  // parent-category keyword, and would otherwise fall through to Other.
  for (const category of relevantCategories) {
    if (!category.subcategories) continue;
    for (const subcat of category.subcategories) {
      if (subcat.keywords.some(keyword => desc.includes(keyword.toLowerCase()))) {
        return { category: category.name, subcategory: subcat.name };
      }
    }
  }

  // Default categorization
  return {
    category: isIncome ? 'Other Income' : 'Other Expenses'
  };
}
