import unittest

from backend.modules.relationship_builder import build_formal_graph_snapshot
from backend.types import Agent, Group, StageEndState, StageOutput, StanceResult


class RelationshipBuilderTests(unittest.TestCase):
    def test_builds_membership_and_inter_entity_edges(self) -> None:
        agents = [
            Agent(id="a1", persona="Farmer"),
            Agent(id="a2", persona="Shop Owner"),
            Agent(id="a3", persona="Union Organizer"),
        ]
        groups = [
            Group(
                group_id="g1",
                name="Growth Bloc",
                description="Pro-growth coalition",
                stance_posture="supportive",
                primary_incentive="M",
            ),
            Group(
                group_id="g2",
                name="Labor Front",
                description="Labor-first coalition",
                stance_posture="opposing",
                primary_incentive="P",
            ),
        ]
        results = [
            StanceResult(
                agent_id="a1",
                assigned_group_id="g1",
                stance="Support",
                score=1,
                incentive_active="M",
                reasoning="Expected economic upside",
            ),
            StanceResult(
                agent_id="a2",
                assigned_group_id="g1",
                stance="Strongly Support",
                score=2,
                incentive_active="M",
                reasoning="Business growth",
            ),
            StanceResult(
                agent_id="a3",
                assigned_group_id="g2",
                stance="Oppose",
                score=-1,
                incentive_active="P",
                reasoning="Worker risk concerns",
            ),
        ]
        stage_output = StageOutput(
            stage="T2",
            groups=groups,
            results=results,
            end_state=StageEndState(
                social_response_summary="Split response by class incentives",
                new_event_state="Debate intensifies around labor protections",
            ),
        )

        snapshot = build_formal_graph_snapshot(
            run_id="run-test",
            agents=agents,
            stage_output=stage_output,
        )

        edge_types = [edge.edge_type for edge in snapshot.edges]
        self.assertIn("MEMBER_OF", edge_types)
        self.assertIn("ALIGNS_WITH", edge_types)
        self.assertIn("CONFLICTS_WITH", edge_types)
        # With opposite stances and incentive split, group rivalry should appear.
        self.assertIn("COMPETES_WITH", edge_types)

        self.assertTrue(any(node.node_type == "run" for node in snapshot.nodes))
        self.assertTrue(any(node.node_type == "stage" for node in snapshot.nodes))


if __name__ == "__main__":
    unittest.main()
