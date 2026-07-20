export default function FooterCredit({ className = '' }) {
  return (
    <p className={className}>
      © {new Date().getFullYear()} All Rights Reserved. Designed by{' '}
      <a
        href="https://msproject.in"
        target="_blank"
        rel="noopener noreferrer"
        className="text-inherit transition-opacity hover:opacity-80"
      >
        M S Project (msproject.in)
      </a>
    </p>
  );
}
