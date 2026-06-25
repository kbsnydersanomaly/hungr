# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: subscription-invalid-menu.spec.ts >> Invalid subscription hides public menu >> cancelled subscription returns 404 and shows dashboard banner
- Location: tests/e2e/subscription-invalid-menu.spec.ts:19:7

# Error details

```
Test timeout of 240000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - link "Hungr" [ref=e5] [cursor=pointer]:
        - /url: /
        - img "Hungr" [ref=e6]
      - navigation [ref=e7]:
        - link "Overview" [ref=e8] [cursor=pointer]:
          - /url: /restaurants/3768792a-9e6d-4f82-8309-2c1e801e9ff3
          - img [ref=e9]
          - text: Overview
        - link "Insights" [ref=e14] [cursor=pointer]:
          - /url: /insights
          - img [ref=e15]
          - text: Insights
        - link "Menus" [ref=e17] [cursor=pointer]:
          - /url: /restaurants/3768792a-9e6d-4f82-8309-2c1e801e9ff3/menus
          - img [ref=e18]
          - text: Menus
        - link "Specials" [ref=e23] [cursor=pointer]:
          - /url: /restaurants/3768792a-9e6d-4f82-8309-2c1e801e9ff3/specials
          - img [ref=e24]
          - text: Specials
        - link "Branding" [ref=e26] [cursor=pointer]:
          - /url: /restaurants/3768792a-9e6d-4f82-8309-2c1e801e9ff3/branding
          - img [ref=e27]
          - text: Branding
        - link "About" [ref=e33] [cursor=pointer]:
          - /url: /restaurants/3768792a-9e6d-4f82-8309-2c1e801e9ff3/about
          - img [ref=e34]
          - text: About
        - link "QR Codes" [ref=e36] [cursor=pointer]:
          - /url: /restaurants/3768792a-9e6d-4f82-8309-2c1e801e9ff3/qr
          - img [ref=e37]
          - text: QR Codes
        - link "Reviews" [ref=e43] [cursor=pointer]:
          - /url: /restaurants/3768792a-9e6d-4f82-8309-2c1e801e9ff3/reviews
          - img [ref=e44]
          - text: Reviews
        - link "Media" [ref=e46] [cursor=pointer]:
          - /url: /restaurants/3768792a-9e6d-4f82-8309-2c1e801e9ff3/media
          - img [ref=e47]
          - text: Media
        - link "Team" [ref=e51] [cursor=pointer]:
          - /url: /restaurants/3768792a-9e6d-4f82-8309-2c1e801e9ff3/team
          - img [ref=e52]
          - text: Team
        - link "Billing" [ref=e57] [cursor=pointer]:
          - /url: /restaurants/3768792a-9e6d-4f82-8309-2c1e801e9ff3/billing
          - img [ref=e58]
          - text: Billing
        - link "Settings" [ref=e60] [cursor=pointer]:
          - /url: /restaurants/3768792a-9e6d-4f82-8309-2c1e801e9ff3/settings
          - img [ref=e61]
          - text: Settings
      - generic [ref=e65]:
        - paragraph [ref=e66]: Organization
        - link "Invalid Sub's Organization" [ref=e67] [cursor=pointer]:
          - /url: /settings/organization
    - generic [ref=e68]:
      - banner [ref=e69]:
        - generic [ref=e70]:
          - generic [ref=e71]: Dashboard
          - img [ref=e72]
          - link "Invalid Sub's Organization" [ref=e74] [cursor=pointer]:
            - /url: /settings/organization
          - img [ref=e75]
          - button "Invalid Sub 1782298458896" [ref=e77] [cursor=pointer]:
            - text: Invalid Sub 1782298458896
            - img [ref=e78]
        - generic [ref=e80]:
          - button "Notifications" [ref=e81] [cursor=pointer]:
            - img [ref=e82]
          - button "Account menu" [ref=e85] [cursor=pointer]: E
      - main [ref=e86]:
        - generic [ref=e87]:
          - heading "Something went wrong" [level=2] [ref=e88]
          - paragraph [ref=e89]: "Functions are not valid as a child of Client Components. This may happen if you return children instead of <children /> from render. Or maybe you meant to call this function rather than return it. <... action=... children={function children}> ^^^^^^^^^^^^^^^^^^^"
          - button "Try again" [ref=e90]
  - region "Notifications alt+T"
  - generic [ref=e95] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e96]:
      - img [ref=e97]
    - generic [ref=e100]:
      - button "Open issues overlay" [ref=e101]:
        - generic [ref=e102]:
          - generic [ref=e103]: "0"
          - generic [ref=e104]: "1"
        - generic [ref=e105]: Issue
      - button "Collapse issues badge" [ref=e106]:
        - img [ref=e107]
  - alert [ref=e109]
```