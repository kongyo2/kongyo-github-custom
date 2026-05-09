type Props = { message: string; show: boolean };

export const Toast = ({ message, show }: Props): JSX.Element => (
  <div className="toast" data-show={show} role="status" aria-live="polite">
    {message}
  </div>
);
