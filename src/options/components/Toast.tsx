export type ToastKind = "ok" | "error";

type Props = { message: string; show: boolean; kind?: ToastKind };

export const Toast = ({ message, show, kind = "ok" }: Props): JSX.Element => (
  <div
    className="toast"
    data-show={show}
    data-kind={kind}
    role="status"
    aria-live={kind === "error" ? "assertive" : "polite"}
  >
    {message}
  </div>
);
