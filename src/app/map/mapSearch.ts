import {
  Egg, Milk, Beef, Fish, Carrot, Circle,
  Wine, Store, Droplets, Leaf,
} from 'lucide-react'

export const CATEGORIES = [
  { id: 'eggs',    label: 'Eggs',    color: '#eab308', Icon: Egg      },
  { id: 'dairy',   label: 'Dairy',   color: '#38bdf8', Icon: Milk     },
  { id: 'meat',    label: 'Meat',    color: '#ef4444', Icon: Beef     },
  { id: 'fish',    label: 'Fish',    color: '#2563eb', Icon: Fish     },
  { id: 'produce', label: 'Produce', color: '#10b981', Icon: Carrot   },
  { id: 'cheese',  label: 'Cheese',  color: '#f97316', Icon: Circle   },
  { id: 'wine',    label: 'Wine',    color: '#7c3aed', Icon: Wine     },
  { id: 'markets', label: 'Markets', color: '#92400e', Icon: Store    },
  { id: 'honey',   label: 'Honey',   color: '#d97706', Icon: Droplets },
  { id: 'organic', label: 'Organic', color: '#059669', Icon: Leaf     },
] as const

export type CategoryId = (typeof CATEGORIES)[number]['id']
export type Category   = (typeof CATEGORIES)[number]
