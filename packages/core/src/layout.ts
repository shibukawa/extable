export function measureTextHeight(text: string, width: number, font: string) {
  const div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.font = font;
  div.style.width = `${width}px`;
  div.style.whiteSpace = 'normal';
  div.style.overflowWrap = 'anywhere';
  div.textContent = text;
  document.body.appendChild(div);
  const height = div.clientHeight;
  div.remove();
  return height;
}
