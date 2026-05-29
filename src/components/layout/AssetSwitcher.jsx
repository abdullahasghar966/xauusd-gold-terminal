import './AssetSwitcher.css';

export default function AssetSwitcher({ assets, value, onChange }) {
  if (!assets || assets.length < 2) {
    return (
      <div className="asset-switcher single" aria-label="Active asset">
        <span className="asset-chip active">{assets?.[0]?.label || 'Gold'}</span>
        <span className="asset-hint mono">drop CSV → /public</span>
      </div>
    );
  }
  return (
    <div className="asset-switcher" role="group" aria-label="Asset selector">
      {assets.map((a) => (
        <button
          key={a.id}
          type="button"
          className={`asset-chip ${value?.id === a.id ? 'active' : ''}`}
          aria-pressed={value?.id === a.id}
          onClick={() => onChange(a)}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
