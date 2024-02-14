import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Artico",
  description: "WebRTC made simple",
  head: [["link", { ref: "icon", type: "image/png", href: "/logo.png" }]],
  themeConfig: {
    logo: "/logo.png",
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: "Home", link: "/" },
      { text: "About", link: "/about" },
    ],

    sidebar: [
      {
        text: "Getting Started",
        link: "/getting-started",
      },
      {
        text: "About",
        link: "/about",
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/matallui/artico" },
    ],
  },
});
