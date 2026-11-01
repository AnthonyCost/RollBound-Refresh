import { ICON_PATHS } from './iconPaths.js';

// The site's icons, mostly from game-icons.net. scripts/build-icons.js lists them.
export default function Icon({ name, size = 20 }) {
  const icon = ICON_PATHS[name];
  if (icon?.line) {
    return (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d={icon.line} />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 512 512" fill="currentColor">
      {icon && <path d={icon.d} transform={icon.rotate ? `rotate(${icon.rotate} 256 256)` : undefined} />}
    </svg>
  );
}
