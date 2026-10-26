import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, useParams } from 'react-router-dom';
import PageShell from '../components/PageShell.jsx';
import Icon from '../components/Icon.jsx';
import { TOPICS, topicBySlug } from '../learn/lessons.js';

/** The tabs under the header: one per part of the game. */
function LearnTabs() {
  return (
    <nav className="nav" aria-label="Topics">
      {TOPICS.map((t) => (
        <NavLink key={t.slug} to={`/learn/${t.slug}`}>
          <Icon name={t.icon} /> {t.label.toUpperCase()}
        </NavLink>
      ))}
    </nav>
  );
}

const lessonId = (n) => `lesson-${n}`;

function Lesson({ lesson, number }) {
  return (
    <section className="lesson" id={lessonId(number)} aria-labelledby={`${lessonId(number)}-title`}>
      <h2 className="lesson__title" id={`${lessonId(number)}-title`}>
        <span className="lesson__number">{number}</span> {lesson.title}
      </h2>
      {lesson.body.map((p) => <p key={p.slice(0, 40)}>{p}</p>)}
      {lesson.table && (
        <table className="lesson__table">
          <thead>
            <tr>{lesson.table.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
          </thead>
          <tbody>
            {lesson.table.rows.map((row) => (
              <tr key={row[0]}>{row.map((cell, i) => (i ? <td key={i}>{cell}</td> : <th key={i} scope="row">{cell}</th>))}</tr>
            ))}
          </tbody>
        </table>
      )}
      {lesson.list && (
        <ul className="lesson__list">
          {lesson.list.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
      {lesson.tip && (
        <p className="lesson__tip">
          <span className="eyebrow">In RollBound</span> {lesson.tip.text} <Link to={lesson.tip.to}>{lesson.tip.label}</Link>
        </p>
      )}
      {lesson.more && (
        <a className="lesson__more" href={lesson.more} target="_blank" rel="noreferrer">
          Full rules on Archives of Nethys <Icon name="external" size={14} />
        </a>
      )}
    </section>
  );
}

/** "On this page": the topic's lessons, marking the one being read. Desktop only. */
function Contents({ lessons }) {
  const [current, setCurrent] = useState(1);
  useEffect(() => {
    const seen = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        // The first lesson on screen (from the top) is the one being read.
        const first = lessons.findIndex((_, i) => seen.get(lessonId(i + 1)));
        if (first >= 0) setCurrent(first + 1);
      },
      { rootMargin: '-15% 0px -55% 0px' },
    );
    lessons.forEach((_, i) => {
      const el = document.getElementById(lessonId(i + 1));
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [lessons]);

  return (
    <nav className="learn__contents" aria-label="On this page">
      <p className="eyebrow">On this page</p>
      <ol>
        {lessons.map((l, i) => (
          <li key={l.title}>
            <a href={`#${lessonId(i + 1)}`} aria-current={current === i + 1 ? 'location' : undefined}>
              {l.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Learning the Game: a topic's lessons, with the next topic linked at the end. */
export default function LearnPage() {
  const { topic: slug } = useParams();
  const topic = topicBySlug(slug);
  if (!topic) return <Navigate to="/learn/overview" replace />;
  const next = TOPICS[TOPICS.indexOf(topic) + 1];

  return (
    <PageShell crumbs={[{ label: 'Learning The Game', to: '/learn/overview' }, { label: topic.label }]} tabs={<LearnTabs />}>
      <header className="learn__head">
        <p className="eyebrow">Learning The Game</p>
        <h1 className="title">{topic.label}</h1>
        <p className="rule-note">{topic.blurb}</p>
      </header>
      <div className="learn__body">
        <Contents key={topic.slug} lessons={topic.lessons} />
        <div className="learn__lessons">
          {topic.lessons.map((l, i) => <Lesson key={l.title} lesson={l} number={i + 1} />)}
        </div>
      </div>
      {next && (
        <Link className="panel learn__next" to={`/learn/${next.slug}`}>
          <span>
            <span className="eyebrow">Next</span>
            <span className="learn__next-label">{next.label}</span>
          </span>
          <Icon name="arrow" />
        </Link>
      )}
    </PageShell>
  );
}
