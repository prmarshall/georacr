import styles from "./UIButton.module.scss";

const preventFocus = (e: React.MouseEvent) => e.preventDefault();

export function UIButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      tabIndex={-1}
      onMouseDown={preventFocus}
      className={`${styles.button} ${className ?? ""}`}
      {...props}
    />
  );
}
