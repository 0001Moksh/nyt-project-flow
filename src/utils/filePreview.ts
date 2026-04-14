const GOOGLE_DRIVE_FILE_REGEX = /drive\.google\.com\/file\/d\/([^/]+)/;

const isOneDriveOrSharePointHost = (hostname: string) => {
  const host = hostname.toLowerCase();
  return host === '1drv.ms' || host === 'onedrive.live.com' || host.endsWith('.sharepoint.com');
};

export const getPreviewUrl = (url: string) => {
  if (!url) return url;

  const googleMatch = url.match(GOOGLE_DRIVE_FILE_REGEX);
  if (googleMatch?.[1]) {
    return `https://drive.google.com/file/d/${googleMatch[1]}/preview`;
  }

  try {
    const parsed = new URL(url);
    if (isOneDriveOrSharePointHost(parsed.hostname)) {
      return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    }
  } catch {
    return url;
  }

  return url;
};