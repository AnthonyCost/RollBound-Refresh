import { ApiError } from '../api.js';

export function errorsFrom(err) {
  if (err instanceof ApiError && err.errors.length) return err.errors;
  if (err instanceof ApiError && err.status >= 500) return ['The server ran into a problem. Try again in a moment.'];
  if (!(err instanceof TypeError) && err?.message && !(err instanceof ApiError)) return [err.message];
  return ["Can't reach the server. Is the API running? You can still try the demo."];
}

export default function FormErrors({ errors }) {
  if (!errors.length) return null;
  return (
    <ul className="form-errors" role="alert">
      {errors.map((e) => <li key={e}>{e}</li>)}
    </ul>
  );
}
