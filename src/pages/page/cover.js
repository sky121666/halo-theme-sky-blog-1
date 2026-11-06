export function initializePageCover(image) {
  if (!image) return () => {};

  const hideBrokenCover = () => {
    image.hidden = true;
  };
  image.addEventListener("error", hideBrokenCover);
  if (image.complete && image.naturalWidth === 0) hideBrokenCover();

  return () => image.removeEventListener("error", hideBrokenCover);
}
