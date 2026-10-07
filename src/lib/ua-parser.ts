export interface UAInfo {
  browser: string;
  os: string;
  device: string;
}

export function parseUserAgent(uaString: string | null): UAInfo {
  if (!uaString) {
    return { browser: 'Unknown', os: 'Unknown', device: 'Desktop' };
  }

  let os = 'Unknown';
  let browser = 'Unknown';
  let device = 'Desktop';

  // 1. Detect OS
  if (/Windows/i.test(uaString)) {
    os = 'Windows';
  } else if (/Macintosh|Mac OS X/i.test(uaString) && !/iPad|iPhone|iPod/i.test(uaString)) {
    os = 'macOS';
  } else if (/iPhone|iPad|iPod/i.test(uaString)) {
    os = 'iOS';
    device = /iPad/i.test(uaString) ? 'Tablet' : 'Mobile';
  } else if (/Android/i.test(uaString)) {
    os = 'Android';
    device = 'Mobile';
  } else if (/Linux/i.test(uaString)) {
    os = 'Linux';
  }

  // 2. Detect Browser
  if (/Firefox/i.test(uaString)) {
    browser = 'Firefox';
  } else if (/Edg/i.test(uaString)) {
    browser = 'Edge';
  } else if (/Chrome/i.test(uaString)) {
    browser = 'Chrome';
  } else if (/Safari/i.test(uaString) && !/Chrome/i.test(uaString)) {
    browser = 'Safari';
  } else if (/OPR|Opera/i.test(uaString)) {
    browser = 'Opera';
  }

  // 3. Simple device fallback checks
  if (/Mobile|Phone|Mobi/i.test(uaString) && device === 'Desktop') {
    device = 'Mobile';
  } else if (/Tablet|Tab/i.test(uaString) && device === 'Desktop') {
    device = 'Tablet';
  }

  return { browser, os, device };
}
