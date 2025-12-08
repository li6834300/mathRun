import Foundation
import Capacitor
import GameKit

@objc(GameCenterPlugin)
public class GameCenterPlugin: CAPPlugin, GKLocalPlayerListener {
    private var localPlayer: GKLocalPlayer?

    @objc func authenticate(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.localPlayer = GKLocalPlayer.local

            self.localPlayer?.authenticateHandler = { [weak self] viewController, error in
                if let error = error {
                    call.reject("Authentication failed: \(error.localizedDescription)")
                    return
                }

                if let viewController = viewController {
                    // Present authentication view controller
                    self?.bridge?.viewController?.present(viewController, animated: true)
                } else if self?.localPlayer?.isAuthenticated == true {
                    // Player is authenticated
                    call.resolve([
                        "authenticated": true,
                        "playerId": self?.localPlayer?.gamePlayerID ?? ""
                    ])
                } else {
                    call.resolve(["authenticated": false])
                }
            }
        }
    }

    @objc func submitScore(_ call: CAPPluginCall) {
        guard let score = call.getInt("score"),
              let leaderboardId = call.getString("leaderboardId") else {
            call.reject("Missing score or leaderboardId")
            return
        }

        guard localPlayer?.isAuthenticated == true else {
            call.reject("Player not authenticated")
            return
        }

        DispatchQueue.main.async {
            GKLeaderboard.submitScore(
                score,
                context: 0,
                player: self.localPlayer!,
                leaderboardIDs: [leaderboardId]
            ) { error in
                if let error = error {
                    call.reject("Failed to submit score: \(error.localizedDescription)")
                } else {
                    call.resolve()
                }
            }
        }
    }

    @objc func showLeaderboard(_ call: CAPPluginCall) {
        guard let leaderboardId = call.getString("leaderboardId") else {
            call.reject("Missing leaderboardId")
            return
        }

        guard localPlayer?.isAuthenticated == true else {
            call.reject("Player not authenticated")
            return
        }

        DispatchQueue.main.async {
            let viewController = GKGameCenterViewController(leaderboardID: leaderboardId, playerScope: .global, timeScope: .allTime)
            viewController.gameCenterDelegate = self
            self.bridge?.viewController?.present(viewController, animated: true)
            call.resolve()
        }
    }
}

extension GameCenterPlugin: GKGameCenterControllerDelegate {
    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}
