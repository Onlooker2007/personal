// The full project pages keep their normal layout unless explicitly embedded.
if (new URLSearchParams(location.search).get('embed') === '1') {
  document.documentElement.classList.add('project-embed');
}
