import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

const SITE_URL = "https://puck-master.lovable.app";
const OG_IMAGE = `${SITE_URL}/og-image.jpg`;

interface SeoProps {
  title: string;
  description: string;
  noindex?: boolean;
  path?: string;
}

export default function Seo({ title, description, noindex, path }: SeoProps) {
  const location = useLocation();
  const url = `${SITE_URL}${path ?? location.pathname}`;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex ? <meta name="robots" content="noindex, nofollow" /> : null}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={OG_IMAGE} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={OG_IMAGE} />
    </Helmet>
  );
}
