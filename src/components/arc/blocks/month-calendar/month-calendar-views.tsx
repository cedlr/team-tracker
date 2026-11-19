"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarDays, Inbox } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import { Avatar } from "../../avatar/avatar";
import { AvatarGroup } from "../../avatar-group/avatar-group";
import { Button } from "../../button/button";
import type { CalendarEvent, CalendarRsvp } from "./month-calendar-data";
import { EventRow } from "./month-calendar-panel";
import { CalendarGlyph, VideoMark, videoName } from "./month-calendar-parts";
import { addDays, byStart, covers, useEdgeFade } from "./month-calendar-utils";
import type { CalendarKit } from "./month-calendar-utils";
import styles from "./month-calendar.module.css";

const instant = { duration: 0 };

export function UpcomingView({ kit, events, matches, filtered, onOpen, onClear }: {
  kit: CalendarKit; events: CalendarEvent[]; matches: (event: CalendarEvent) => boolean; filtered: boolean;
  onOpen: (event: CalendarEvent, node: HTMLElement) => void; onClear: () => void;
}) {
  const scroller = useEdgeFade<HTMLDivElement>();
  const days = Array.from({ length: 28 }, (_, index) => addDays(kit.today, index));
  const groups = days.map(day => ({ day, list: events.filter(event => covers(event, day) && matches(event)).sort(byStart) })).filter(group => group.list.length);
  const label = (day: string) => day === kit.today ? "Today" : day === addDays(kit.today, 1) ? "Tomorrow" : kit.date(day, "short");
  return <div ref={scroller} className={styles.listPage} data-fade="y">
    <div className={styles.listInner}>
      {groups.length ? groups.map(group => <section key={group.day} className={styles.listGroup} aria-label={kit.date(group.day, "long")}>
        <h3 className={styles.listDay}><span>{label(group.day)}</span>{group.day === kit.today || group.day === addDays(kit.today, 1) ? <span className={styles.listDate}>{kit.date(group.day, "day")}</span> : null}</h3>
        <ul className={styles.rows}>{group.list.map(event => <li key={event.id}><EventRow kit={kit} event={event} onOpen={onOpen} /></li>)}</ul>
      </section>) : <div className={styles.notice}>
        <CalendarDays size={20} strokeWidth={1.75} className={styles.noticeIcon} aria-hidden="true" />
        <p className={styles.noticeTitle}>Nothing in the next four weeks</p>
        <p className={styles.noticeBody}>{filtered ? "Your filters hide every event. Clear them to see the full schedule." : "Events you add show up here, soonest first."}</p>
        {filtered && <Button variant="secondary" size="sm" onClick={onClear}>Clear filters</Button>}
      </div>}
    </div>
  </div>;
}

export function InvitationsView({ kit, invites, onReply, onView, onBack }: {
  kit: CalendarKit; invites: CalendarEvent[]; onReply: (event: CalendarEvent, rsvp: CalendarRsvp) => void; onView: (event: CalendarEvent) => void; onBack: () => void;
}) {
  const reduced = useReducedMotion();
  const scroller = useEdgeFade<HTMLDivElement>();
  const fold = reduced ? instant : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.exit } };
  return <div ref={scroller} className={styles.listPage} data-fade="y">
    <div className={styles.listInner}>
      <AnimatePresence initial={false}>
        {invites.map(event => {
          const organizer = event.organizer ? kit.person(event.organizer) : undefined;
          const guests = (event.attendees ?? []).map(attendee => kit.person(attendee.id));
          return <motion.section key={event.id} className={styles.inviteFold} initial={false} exit={{ height: 0, opacity: 0 }} transition={fold} aria-label={event.title}>
            <div className={styles.invite}>
              <div className={styles.inviteFrom}>
                {organizer && <Avatar name={organizer.name} src={organizer.avatar} size="sm" aria-hidden="true" />}
                <p className={styles.inviteWho}><span className={styles.inviteName}>{organizer?.name ?? "Someone"}</span> invited you</p>
                <span className={styles.inviteCal}><CalendarGlyph kit={kit} calendarId={event.calendarId} />{kit.calendar(event.calendarId)?.name}</span>
              </div>
              <div className={styles.inviteBody}>
                <h3 className={styles.inviteTitle}>{event.title}</h3>
                <p className={styles.inviteWhen}>{kit.span(event)}</p>
                <div className={styles.inviteMeta}>
                  {event.video && <span className={styles.rowVideo}><VideoMark provider={event.video.provider} size={14} />{videoName[event.video.provider]}</span>}
                  {event.location && <span>{event.location}</span>}
                  {guests.length > 0 && <span className={styles.inviteGuests}><AvatarGroup size="sm" max={4} label="Guests" members={guests.map(person => ({ name: person.name, src: person.avatar }))} />{guests.length} guests</span>}
                </div>
                {event.notes && <p className={styles.inviteNotes}>{event.notes}</p>}
              </div>
              <div className={styles.inviteActions}>
                <Button variant="primary" size="sm" onClick={() => onReply(event, "yes")}>Accept</Button>
                <Button variant="secondary" size="sm" onClick={() => onReply(event, "maybe")}>Maybe</Button>
                <Button variant="ghost" size="sm" onClick={() => onReply(event, "no")}>Decline</Button>
                <Button variant="ghost" size="sm" className={styles.linkBtn} onClick={() => onView(event)}>View in calendar</Button>
              </div>
            </div>
          </motion.section>;
        })}
      </AnimatePresence>
      {!invites.length && <div className={styles.notice}>
        <Inbox size={20} strokeWidth={1.75} className={styles.noticeIcon} aria-hidden="true" />
        <p className={styles.noticeTitle}>You are all caught up</p>
        <p className={styles.noticeBody}>New invitations land here until you reply.</p>
        <Button variant="secondary" size="sm" onClick={onBack}>Back to calendar</Button>
      </div>}
    </div>
  </div>;
}
