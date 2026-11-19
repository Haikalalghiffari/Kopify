type Props = {
  href: string;
  label: string;
};

export default function DownloadPdfLink({ href, label }: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex text-sm font-medium text-emerald-700 underline hover:text-emerald-800"
    >
      {label}
    </a>
  );
}