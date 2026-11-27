// The browser saves the file at `url` as `name`, as for a click on a download link.
export function startDownload(url: string, name: string) {
  Object.assign(document.createElement("a"), { href: url, download: name }).click();
}
