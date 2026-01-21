import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/deployment">
            Get Started 🚀
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/docs/ui-walkthrough"
            style={{ marginLeft: '1rem' }}>
            View Demo 🖥️
          </Link>
        </div>
      </div>
    </header>
  );
}

function HomepageContent() {
  return (
    <div className="container padding-vert--xl">
      <div className="row">
        <div className="col col--8 col--offset-2">
          <Heading as="h2">The Project Manager for your Home Server</Heading>
          <p>
            <b>Docker Nexus</b> is designed for <b>simple home server setups</b> and personal app hosting.
            It gives you a powerful interface to <b style={{ color: 'var(--ifm-color-primary)' }}>manage, monitor, and organize</b> your Docker Compose stacks.
            Group services, merge configurations, and control your infrastructure without the complexity of enterprise orchestrators.
          </p>

          <img
            src="img/project-list.png"
            alt="Docker Nexus Dashboard"
            style={{ border: '2px solid var(--ifm-color-primary)', width: '100%', marginBottom: '2rem' }}
          />

          <Heading as="h3">Why Use Docker Nexus?</Heading>
          <ul>
            <li>
              <b>Visual Graph</b>: Stop guessing which service connects to which. See your networks and dependencies drawn out.
            </li>
            <li>
              <b>AI Assistant (MCP)</b>: Don't remember the syntax for a specific Docker flag? Just ask the assistant to "add a healthcheck to redis" and let it handle the YAML.
            </li>
            <li>
              <b>One-Click Actions</b>: Start, stop, and deploy entire projects or individual services without touching the terminal.
            </li>
          </ul>

          <Heading as="h3">Getting Started</Heading>
          <p>
            It's as simple as running a single Docker Compose file.
            Check out the <Link to="/docs/deployment">Deployment Guide</Link> to get your instance running in minutes.
          </p>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <div className="card padding--md" style={{ flex: 1 }}>
              <Heading as="h4">🛠️ Deployment</Heading>
              <p>Learn how to install and configure the Docker Nexus backend and frontend.</p>
              <Link to="/docs/deployment">Read Docs &rarr;</Link>
            </div>
            <div className="card padding--md" style={{ flex: 1 }}>
              <Heading as="h4">🤖 MCP Server</Heading>
              <p>Integrate with AI agents using the Model Context Protocol.</p>
              <Link to="/docs/mcp-server">Explore API &rarr;</Link>
            </div>
            <div className="card padding--md" style={{ flex: 1 }}>
              <Heading as="h4">📸 Walkthrough</Heading>
              <p>See the UI in action and learn the features.</p>
              <Link to="/docs/ui-walkthrough">View Gallery &rarr;</Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`Home | ${siteConfig.title}`}
      description="Docker Compose Manager & Visualization Tool">
      <HomepageHeader />
      <main>
        <HomepageContent />
      </main>
    </Layout>
  );
}
