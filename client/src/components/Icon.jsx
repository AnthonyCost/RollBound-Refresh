// Line icons for the header, drawn on a 24px grid like the tab icons.
const PATHS = {
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  plus: <path d="M12 5v14M5 12h14" />,
  caret: <path d="M8 10l4 4 4-4" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  home: <path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
  shield: <path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6z" />,
  map: <path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2zM9 4v14M15 6v14" />,
  spark: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2zM19 3v4M17 5h4" />,
  book: (
    <>
      <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
      <path d="M5 17a3 3 0 0 1 3-3h11M10 8h5" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  swords: <path d="M4 4l9 9M4 4v3l9 9M4 4h3l9 9M14 18l4-4M16 20l4-4M20 4l-6 6M20 4h-3M20 4v3M6 14l4 4M4 20l3-3" />,
  crown: <path d="M4 18h16M5 15l-1-8 5 4 3-6 3 6 5-4-1 8z" />,
  learn: <path d="M3 9l9-5 9 5-9 5zM7 11v5c3 2 7 2 10 0v-5M21 9v6" />,
  links: <path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
};

export default function Icon({ name, size = 20 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name]}
    </svg>
  );
}
