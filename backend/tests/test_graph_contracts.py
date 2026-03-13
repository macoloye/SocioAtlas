import unittest

from backend.types import (
    ChatResponse,
    GraphEvidence,
    GraphRetrieveResponse,
    GraphSnapshot,
    Stage,
)


class GraphContractTests(unittest.TestCase):
    def test_graph_snapshot_contract_shape(self) -> None:
        snapshot = GraphSnapshot(run_id="run-1", nodes=[], edges=[])
        self.assertEqual(snapshot.run_id, "run-1")
        self.assertEqual(snapshot.nodes, [])
        self.assertEqual(snapshot.edges, [])

    def test_graph_retrieve_contract_shape(self) -> None:
        evidence = GraphEvidence(
            id="edge:1",
            kind="edge",
            label="ALIGNS_WITH",
            score=0.92,
            stage="T3",
            details="ALIGNS_WITH agent:a -> agent:b",
        )
        payload = GraphRetrieveResponse(run_id="run-1", query="who aligns", evidence=[evidence])
        self.assertEqual(payload.run_id, "run-1")
        self.assertEqual(payload.evidence[0].kind, "edge")

    def test_chat_response_contract_shape(self) -> None:
        evidence = [
            GraphEvidence(
                id="node:1",
                kind="node",
                label="Group A",
                score=0.5,
                stage=None,
                details="group Group A",
            )
        ]
        stages_used: list[Stage] = ["T1", "T2"]
        response = ChatResponse(answer="Group A leads early support.", evidence=evidence, stages_used=stages_used)
        self.assertTrue(response.answer.startswith("Group A"))
        self.assertEqual(response.stages_used, ["T1", "T2"])


if __name__ == "__main__":
    unittest.main()
