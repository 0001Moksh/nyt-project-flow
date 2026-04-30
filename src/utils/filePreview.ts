const GOOGLE_DRIVE_FILE_REGEX = /drive\.google\.com\/file\/d\/([^/]+)/;
const GOOGLE_DRIVE_OPEN_ID_REGEX = /drive\.google\.com\/(?:open|uc)\?id=([^&]+)/;

const isOneDriveOrSharePointHost = (hostname: string) => {
  const host = hostname.toLowerCase();
  return (
    host === '1drv.ms' ||
    host.endsWith('.1drv.ms') ||
    host === 'onedrive.live.com' ||
    host.endsWith('.sharepoint.com')
  );
};

const toOfficeEmbed = (url: string) =>
  `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;

export const extractFirstUrl = (text?: string | null) => {
  if (!text) return '';
  const match = text.match(/https?:\/\/[^\s<>"']+/);
  return match ? match[0].replace(/[),.;]+$/, '') : '';
};

export const getPreviewUrl = (url: string) => {
  if (!url) return url;

  const googleMatch = url.match(GOOGLE_DRIVE_FILE_REGEX);
  if (googleMatch?.[1]) {
    return `https://drive.google.com/file/d/${googleMatch[1]}/preview`;
  }

  const googleOpenMatch = url.match(GOOGLE_DRIVE_OPEN_ID_REGEX);
  if (googleOpenMatch?.[1]) {
    return `https://drive.google.com/file/d/${googleOpenMatch[1]}/preview`;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host === 'view.officeapps.live.com') {
      return url;
    }

    // SharePoint & OneDrive for Business
    // We add action=embedview to all sharepoint links to force the iframe preview UI without menus
    if (host.endsWith('.sharepoint.com')) {
      parsed.searchParams.set('action', 'embedview');
      parsed.searchParams.delete('mobileredirect');
      return parsed.toString();
    }

    // Personal OneDrive
    if (host === 'onedrive.live.com') {
      const id = parsed.searchParams.get('resid') || parsed.searchParams.get('id');
      const cid = parsed.searchParams.get('cid');
      
      if (id) {
        const embed = new URL('https://onedrive.live.com/embed');
        embed.searchParams.set('resid', id);
        
        if (cid) embed.searchParams.set('cid', cid);

        const authkey = parsed.searchParams.get('authkey');
        if (authkey) {
          embed.searchParams.set('authkey', authkey);
        }

        embed.searchParams.set('em', '2');
        return embed.toString();
      }
    }

    if (isOneDriveOrSharePointHost(parsed.hostname)) {
      return toOfficeEmbed(url);
    }
  } catch {
    return url;
  }

  return url;
};
