import { ReactNode } from 'react';

interface BottomNavItem {
  icon: ReactNode;
  label: string;
  href: string;
  isActive: boolean;
  onClick: () => void;
}

interface BottomNavProps {
  items: BottomNavItem[];
}

export default function BottomNav({ items }: BottomNavProps) {
  return (
    <nav className="bottom-nav">
      {items.map((item, index) => (
        <button
          key={index}
          onClick={item.onClick}
          className={`bottom-nav-item ${item.isActive ? 'active' : ''}`}
          aria-label={item.label}
        >
          <span className="bottom-nav-icon">{item.icon}</span>
          <span className="bottom-nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
