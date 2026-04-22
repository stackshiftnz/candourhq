import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScorePreview } from "@/components/analysis/ScorePreview";
import React from 'react';

describe("ScorePreview Component", () => {
  it("renders nothing when not visible and not loading", () => {
    const { container } = render(
      <ScorePreview data={null} isLoading={false} isVisible={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders loading state correctly", () => {
    render(<ScorePreview data={null} isLoading={true} isVisible={false} />);
    expect(screen.getByText(/Running pre-flight scan/i)).toBeDefined();
  });

  it("renders preview data correctly for high score with flagged phrase", () => {
    const mockData = {
      scoreRange: "high" as const,
      headline: "Great engagement patterns",
      flaggedCategory: "Tone",
      flaggedPhrase: "unlocking potential today",
      issueCount: 1,
    };

    render(<ScorePreview data={mockData} isLoading={false} isVisible={true} />);

    expect(screen.getByText("Great engagement patterns")).toBeDefined();
    expect(screen.getByText(/Mostly clean/i)).toBeDefined();
    expect(screen.getByText(/unlocking potential today/i)).toBeDefined();
  });

  it("shows no patterns flagged when high score and zero issues", () => {
    const mockData = {
      scoreRange: "high" as const,
      headline: "Strong human voice throughout",
      flaggedCategory: "Tone",
      flaggedPhrase: null,
      issueCount: 0,
    };

    render(<ScorePreview data={mockData} isLoading={false} isVisible={true} />);
    expect(screen.getByText(/No patterns flagged/i)).toBeDefined();
  });

  it("applies correct color themes for score ranges", () => {
    const { rerender } = render(
      <ScorePreview
        data={{ scoreRange: "low", headline: "Bad", flaggedCategory: "X", flaggedPhrase: "Y", issueCount: 5 }}
        isLoading={false}
        isVisible={true}
      />
    );
    expect(screen.getByText(/Needs significant work/i)).toBeDefined();

    rerender(
      <ScorePreview
        data={{ scoreRange: "medium", headline: "Ok", flaggedCategory: "X", flaggedPhrase: "Y", issueCount: 2 }}
        isLoading={false}
        isVisible={true}
      />
    );
    expect(screen.getByText(/Some issues to address/i)).toBeDefined();
  });
});
