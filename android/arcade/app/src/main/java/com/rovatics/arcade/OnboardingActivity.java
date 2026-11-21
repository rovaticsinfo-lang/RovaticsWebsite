package com.rovatics.arcade;

import android.content.res.Resources;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.RecyclerView;
import androidx.viewpager2.widget.ViewPager2;

/**
 * A short welcome tour shown the first time the app opens (and from About -> "Take the tour again").
 * The slides come from the game's own resources: ob_emoji, ob_titles and ob_bodies string arrays.
 */
public class OnboardingActivity extends AppCompatActivity {

    private String[] emoji, titles, bodies;
    private ViewPager2 pager;
    private LinearLayout dots;
    private Button next;
    private TextView skip;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_onboarding);
        InsetsUtil.padForSystemBars(findViewById(R.id.root));

        Resources r = getResources();
        emoji = r.getStringArray(R.array.ob_emoji);
        titles = r.getStringArray(R.array.ob_titles);
        bodies = r.getStringArray(R.array.ob_bodies);

        pager = findViewById(R.id.pager);
        dots = findViewById(R.id.dots);
        next = findViewById(R.id.next);
        skip = findViewById(R.id.skip);

        pager.setAdapter(new SlideAdapter());
        buildDots();
        select(0);

        pager.registerOnPageChangeCallback(new ViewPager2.OnPageChangeCallback() {
            @Override
            public void onPageSelected(int position) { select(position); }
        });
        next.setOnClickListener(v -> {
            int p = pager.getCurrentItem();
            if (p < emoji.length - 1) pager.setCurrentItem(p + 1, true); else finishTour();
        });
        skip.setOnClickListener(v -> finishTour());
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() { finishTour(); }
        });
    }

    private void finishTour() {
        Prefs.setOnboarded(this, true);
        finish();
    }

    private void buildDots() {
        dots.removeAllViews();
        float d = getResources().getDisplayMetrics().density;
        for (int i = 0; i < emoji.length; i++) {
            View dot = new View(this);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams((int) (8 * d), (int) (8 * d));
            lp.setMargins((int) (4 * d), 0, (int) (4 * d), 0);
            dot.setLayoutParams(lp);
            dots.addView(dot);
        }
    }

    private void select(int position) {
        float d = getResources().getDisplayMetrics().density;
        for (int i = 0; i < dots.getChildCount(); i++) {
            View dot = dots.getChildAt(i);
            boolean on = i == position;
            dot.setBackgroundResource(on ? R.drawable.dot_on : R.drawable.dot_off);
            ViewGroup.LayoutParams lp = dot.getLayoutParams();
            lp.width = (int) ((on ? 24 : 8) * d);
            dot.setLayoutParams(lp);
        }
        boolean last = position == emoji.length - 1;
        next.setText(last ? R.string.lets_play : R.string.next);
        skip.setVisibility(last ? View.INVISIBLE : View.VISIBLE);
    }

    private final class SlideAdapter extends RecyclerView.Adapter<SlideAdapter.Holder> {
        @NonNull
        @Override
        public Holder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            View v = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_onboarding, parent, false);
            v.setLayoutParams(new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            return new Holder(v);
        }

        @Override
        public void onBindViewHolder(@NonNull Holder h, int position) {
            h.emoji.setText(emoji[position]);
            h.title.setText(titles[position]);
            h.body.setText(bodies[position]);
        }

        @Override
        public int getItemCount() { return emoji.length; }

        final class Holder extends RecyclerView.ViewHolder {
            final TextView emoji, title, body;
            Holder(@NonNull View v) {
                super(v);
                emoji = v.findViewById(R.id.emoji);
                title = v.findViewById(R.id.title);
                body = v.findViewById(R.id.body);
            }
        }
    }
}
