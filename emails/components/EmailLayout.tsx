import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";

// SVG is stripped by most email clients, so emails use the PNG logo.
const logoUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/logo.png`;

export function EmailLayout({
  preview,
  children,
}: {
  preview: string;
  children: React.ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f6f6f6", margin: 0, padding: 0 }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            borderTop: "4px solid #FE1B54",
            margin: "40px auto",
            maxWidth: "480px",
            padding: "32px",
          }}
        >
          <Section>
            <Img
              src={logoUrl}
              alt="Hungr"
              width={140}
              height={47}
              style={{ marginBottom: "24px" }}
            />
            {children}
          </Section>
        </Container>
        <Text
          style={{
            color: "#888888",
            fontSize: "12px",
            margin: "0 auto 40px",
            maxWidth: "480px",
            textAlign: "center",
          }}
        >
          &copy; {new Date().getFullYear()} Hungr. All rights reserved.
        </Text>
      </Body>
    </Html>
  );
}

export function EmailButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      style={{
        backgroundColor: "#FE1B54",
        borderRadius: "6px",
        color: "#ffffff",
        display: "inline-block",
        fontSize: "14px",
        fontWeight: 500,
        padding: "12px 24px",
        textDecoration: "none",
      }}
    >
      {children}
    </a>
  );
}
