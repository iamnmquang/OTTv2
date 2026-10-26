import { useState } from "react";
import type { KnockoutGame } from "@web/features/bot-cup/BotCupApiGateway";
import { KnockoutTree } from "@web/features/bot-cup/bracket/KnockoutTree";
import { PairingGames } from "@web/features/bot-cup/bracket/PairingGames";
import { SwissRounds } from "@web/features/bot-cup/bracket/SwissRounds";
import { score, slotLabel } from "@web/features/bot-cup/bracket/bracketFormat";
import { Loaded, useAdmin, useLoad } from "../admin";
import { PHASE_LABEL } from "../format";
import type { TournamentAdminView } from "../types";
import { ActButton, Section, StatCard, Tag } from "../components/parts";
import styles from "../admin.module.css";

const STATUS: Readonly<Record<string, string>> = { queued: "chờ", running: "đang chạy", finished: "xong", failed: "lỗi", cancelled: "huỷ" };

/** Games of every stage on screen, by status: how far the current round is. */
function progress(data: TournamentAdminView) {
  const games = [...data.rounds.flatMap((round) => round.pairings.flatMap((pairing) => pairing.games)), ...data.knockout.flatMap((pairing) => pairing.games)];
  const count = (status: string) => games.filter((game) => game.status === status).length;
  return { total: games.length, finished: count("finished"), running: count("running"), queued: count("queued"), failed: count("failed") };
}

/**
 * The bracket as the public sees it (same components as the player site), plus what only organisers need: game status
 * and a rerun for each game, progress of the stage, and links to the public page and the projector.
 */
export function Bracket() {
  const { me, show } = useAdmin();
  const load = useLoad((api) => api.get<TournamentAdminView>("/tournament"));
  const [section, setSection] = useState<"knockout" | "qualifying">("knockout");
  const [selected, setSelected] = useState<string | null>(null);
  const publicUrl = (screen: string) => (me.publicWebOrigin ? `${me.publicWebOrigin.replace(/\/$/, "")}/?view=bot-cup&screen=${screen}` : null);

  const gameActions = (game: KnockoutGame) => (
    <span className={styles.gameAdmin}>
      <Tag status={game.status === "finished" ? "success" : game.status === "failed" ? "danger" : "neutral"}>{STATUS[game.status] ?? game.status}</Tag>
      <ActButton variant="quiet" label="Chạy lại" spec={{ title: "Chạy lại ván", path: `/matches/${game.id}/rerun`, description: `Ván ${game.gameIndex + 1} (${game.id}): kết quả cũ bị huỷ, ván được xếp lại hàng đợi.` }} />
    </span>
  );

  return (
    <Loaded load={load}>
      {(data) => {
        const stats = progress(data);
        const pick = data.bracket.rounds.flatMap((round) => round.slots).find((slot) => slot.slot === selected)?.pairing ?? null;
        const links = (
          <>
            {publicUrl("bracket") ? <a className={styles.linkButton} href={publicUrl("bracket") ?? undefined} target="_blank" rel="noopener noreferrer">Mở trang công khai</a> : null}
            {publicUrl("projector") ? <a className={styles.linkButton} href={publicUrl("projector") ?? undefined} target="_blank" rel="noopener noreferrer">Mở màn trình chiếu</a> : null}
          </>
        );
        return (
          <>
            <Section title="Nhánh đấu" actions={links}>
              <p>
                Giai đoạn <Tag status="info">{PHASE_LABEL[data.phase] ?? data.phase}</Tag> · Nhánh loại trực tiếp {data.bracket.size || data.knockoutSize} đội ·
                {" "}Kết quả công khai tự động: người xem thấy đúng những gì ở đây, trừ trạng thái job và nút chạy lại.
              </p>
              {me.publicWebOrigin ? null : <p className={styles.muted}>Chưa đặt BOT_CUP_WEB_ORIGIN cho Worker này nên không có link sang trang công khai.</p>}
              <div className={styles.cards}>
                <StatCard label="Ván đã xong (vòng loại và loại trực tiếp)" value={stats.finished} />
                <StatCard label="Ván đang chạy" value={stats.running} />
                <StatCard label="Ván đang chờ" value={stats.queued} />
                <StatCard label="Ván lỗi" value={stats.failed} alert onOpen={() => show("runners")} />
              </div>
              <div className={styles.segmented} role="group" aria-label="Phần nhánh đấu">
                <button type="button" aria-pressed={section === "knockout"} onClick={() => setSection("knockout")}>Loại trực tiếp</button>
                <button type="button" aria-pressed={section === "qualifying"} onClick={() => setSection("qualifying")}>Vòng loại ({data.rounds.length} vòng)</button>
              </div>
            </Section>

            {section === "knockout" ? (
              <Section title={data.bracket.size ? `Loại trực tiếp · ${data.bracket.size} đội` : "Loại trực tiếp"}>
                {data.knockout.length === 0 ? <p className={styles.muted}>Nhánh được điền sau vòng loại và phỏng vấn; khung dưới đây là cỡ nhánh dự kiến.</p> : null}
                <KnockoutTree bracket={data.bracket} selected={selected} onSelect={(slot) => setSelected(selected === slot ? null : slot)} />
                {pick && selected ? (
                  <div className={styles.detail}>
                    <h3>{slotLabel(selected)}: {pick.red} ({pick.seeds[0]}) {score(pick.points[0])} – {score(pick.points[1])} {pick.blue} ({pick.seeds[1]})</h3>
                    <p className={styles.muted}>
                      {pick.winner ? `${pick.winner} đi tiếp${pick.decidedBySeed ? " (hạt giống cao hơn)" : ""}.` : "Chưa phân thắng thua."}
                      {pick.tiebreaks ? ` ${pick.tiebreaks} lượt tie-break.` : ""}
                    </p>
                    <PairingGames red={pick.red} blue={pick.blue} games={pick.games} actions={gameActions} />
                  </div>
                ) : data.knockout.length ? <p className={styles.muted}>Chọn một cặp để xem từng ván, trạng thái và chạy lại.</p> : null}
              </Section>
            ) : (
              <Section title={`Vòng loại · ${data.standings.format === "round_robin" ? "vòng tròn" : data.standings.format === "swiss" ? "Swiss" : "chưa bắt đầu"}`}>
                {data.standings.format
                  ? <SwissRounds rounds={data.rounds} format={data.standings.format} gameActions={gameActions} />
                  : <p className={styles.muted}>Vòng loại chưa bắt đầu.</p>}
              </Section>
            )}
          </>
        );
      }}
    </Loaded>
  );
}
