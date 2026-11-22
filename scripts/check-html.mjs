const url = process.argv[2] ?? "http://localhost:3001/";
const response = await fetch(url);
const html = await response.text();
const count = (re) => (html.match(re) ?? []).length;

console.log("status", response.status, url);
console.log("title", /<title>([^<]+)<\/title>/.exec(html)?.[1]);
console.log("description length", /name="description" content="([^"]+)"/.exec(html)?.[1]?.length);
console.log("canonical", /rel="canonical" href="([^"]+)"/.exec(html)?.[1]);
console.log("robots", /name="robots" content="([^"]+)"/.exec(html)?.[1] ?? "(none)");
console.log("og:image", /property="og:image" content="([^"]+)"/.exec(html)?.[1] ?? "(none)");
console.log("h1", count(/<h1[ >]/g), "h2", count(/<h2[ >]/g), "h3", count(/<h3[ >]/g));
console.log("lang", /<html[^>]*lang="([^"]+)"/.exec(html)?.[1]);
console.log("ld+json blocks", count(/application\/ld\+json/g));
console.log("imgs without alt", count(/<img(?![^>]*alt=)/g));
