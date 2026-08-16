import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {HotNColdLeftPalmTest} from "./HotNColdLeftPalmTest"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {
      id: "hotncold_left_palm_test",
      typename: HotNColdLeftPalmTest.getTypeName(),
    },
  ]
}
